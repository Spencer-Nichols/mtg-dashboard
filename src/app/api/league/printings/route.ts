import { NextRequest, NextResponse } from 'next/server'
import { frameSuffix, searchPrintings } from '@/lib/scryfall'
import { cardImageUrl, type DeckScryfallCard } from '@/lib/deck-ideas'
import { leagueContext } from '@/lib/league/store'
import { LeagueError } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  let packSet: string
  try {
    const { state } = await leagueContext()
    packSet = state.settings.packSet ?? 'trk'
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
  const name = req.nextUrl.searchParams.get('name')?.trim().replace(/"/g, '') ?? ''
  if (!name) return NextResponse.json([])
  const prints = (await searchPrintings(name) as DeckScryfallCard[]).filter(c => c.set === packSet)
  return NextResponse.json(prints
    .sort((a, b) => parseInt(a.collector_number) - parseInt(b.collector_number))
    .map(c => ({
      scryfallId: c.id,
      setCode: c.set,
      collectorNumber: c.collector_number,
      label: frameSuffix(c).replace(/[()]/g, '').trim() || 'Regular',
      flavorName: c.flavor_name ?? null,
      imageUrl: cardImageUrl(c),
      finishes: c.finishes ?? ['nonfoil', 'foil'],
    })))
}
