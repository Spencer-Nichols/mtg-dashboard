import { NextRequest, NextResponse } from 'next/server'
import { searchPrintings } from '@/lib/scryfall'
import { cardImageUrl, type DeckScryfallCard } from '@/lib/deck-ideas'
import { leagueContext } from '@/lib/league/store'
import { packSets, printingLabel } from '@/lib/league/pack-sets'
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
  const sets = packSets(packSet)
  const prints = (await searchPrintings(name) as DeckScryfallCard[]).filter(c => sets.includes(c.set))
  return NextResponse.json(prints
    .sort((a, b) => sets.indexOf(a.set) - sets.indexOf(b.set) || parseInt(a.collector_number) - parseInt(b.collector_number))
    .map(c => ({
      scryfallId: c.id,
      setCode: c.set,
      collectorNumber: c.collector_number,
      label: printingLabel(c, packSet),
      flavorName: c.flavor_name ?? null,
      imageUrl: cardImageUrl(c),
      finishes: c.finishes ?? ['nonfoil', 'foil'],
    })))
}
