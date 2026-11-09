import { NextRequest, NextResponse } from 'next/server'
import { proxyUser } from '@/lib/proxy-access'
import { frameSuffix, sleep, type ScryfallCard } from '@/lib/scryfall'
import { cardImageUrl } from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'

const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0', Accept: 'application/json' }
const MAX_PAGES = 3

export async function GET(req: NextRequest) {
  if (!(await proxyUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const cards: ScryfallCard[] = []
  let url: string | null = 'https://api.scryfall.com/cards/search?' + new URLSearchParams({
    q: `!"${name}" game:paper`,
    unique: 'prints',
    order: 'released',
    dir: 'desc',
  })
  for (let page = 0; url && page < MAX_PAGES; page++) {
    if (page > 0) await sleep(120)
    const res: Response = await fetch(url, { headers: HEADERS })
    if (res.status === 404) break
    if (!res.ok) {
      console.error('Proxy printings search failed:', res.status, name)
      return NextResponse.json({ error: 'Scryfall search failed, try again' }, { status: 502 })
    }
    const data = await res.json()
    cards.push(...(data.data ?? []))
    url = data.has_more ? data.next_page : null
  }

  return NextResponse.json({
    printings: cards.map(c => ({
      scryfallId: c.id,
      name: c.name,
      setCode: c.set,
      setName: c.set_name,
      collectorNumber: c.collector_number,
      releasedAt: c.released_at,
      imageUrl: cardImageUrl(c),
      label: frameSuffix(c).replace(/[()]/g, '').trim(),
    })),
  })
}
