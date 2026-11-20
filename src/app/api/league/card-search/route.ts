import { NextRequest, NextResponse } from 'next/server'
import { searchCards } from '@/lib/scryfall'
import { cardImageUrl, type DeckScryfallCard } from '@/lib/deck-ideas'
import { leagueContext } from '@/lib/league/store'
import { packSetQuery, parsePackNumber } from '@/lib/league/pack-sets'
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
  const q = req.nextUrl.searchParams.get('q')?.trim().replace(/"/g, '') ?? ''
  const number = parsePackNumber(q, packSet)
  if (!number && q.length < 2) return NextResponse.json([])
  const cards = await searchCards(number ? `set:${number.set} cn:${number.number}` : `${packSetQuery(packSet)} ${q}`)
  return NextResponse.json((cards as DeckScryfallCard[]).map(c => ({ name: c.name, displayName: c.flavor_name, typeLine: c.type_line, rarity: c.rarity, imageUrl: cardImageUrl(c), colorIdentity: c.color_identity ?? [], collectorNumber: c.collector_number, scryfallId: c.id })))
}
