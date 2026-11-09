import { NextRequest, NextResponse } from 'next/server'
import { proxyUser } from '@/lib/proxy-access'
import { prepareDeck } from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_LINES = 250

// Looks up a pasted list without saving anything, for quick proxies.
export async function POST(req: NextRequest) {
  if (!(await proxyUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { text } = await req.json()
  if (typeof text !== 'string' || !text.trim()) return NextResponse.json({ error: 'Paste at least one card' }, { status: 400 })
  if (text.split('\n').length > MAX_LINES) return NextResponse.json({ error: `Quick proxies take up to ${MAX_LINES} lines. Use a deck for bigger lists.` }, { status: 400 })

  const prepared = await prepareDeck(text, [])
  if (prepared.rows.length === 0) return NextResponse.json({ error: 'No cards found in that list' }, { status: 400 })

  return NextResponse.json({
    unparsed: prepared.unparsed,
    cards: prepared.rows.map((r, i) => ({
      id: `quick-${i}`,
      board: 'main',
      qty: r.qty,
      name: r.name,
      setCode: r.set_code,
      collectorNumber: r.collector_number,
      scryfallId: r.scryfall_id,
      imageUrl: r.image_url,
    })),
  })
}
