import { NextRequest, NextResponse } from 'next/server'
import { fetchBySetNumbers } from '@/lib/scryfall'
import { cardImageUrl, type DeckScryfallCard } from '@/lib/deck-ideas'
import { leagueContext } from '@/lib/league/store'
import { parsePackNumber, printingLabel } from '@/lib/league/pack-sets'
import { LeagueError, type PulledCardInput } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

const MAX_NUMBERS = 20

const keyOf = (set: string, number: string) => `${set}|${number.toLowerCase()}`

function toPull(c: DeckScryfallCard, packSet: string): PulledCardInput & { finishes: string[] } {
  const finishes = c.finishes ?? ['nonfoil', 'foil']
  const foilOnly = finishes.includes('foil') && !finishes.includes('nonfoil')
  return {
    name: c.name,
    displayName: c.flavor_name,
    typeLine: c.type_line ?? c.card_faces?.[0]?.type_line ?? '',
    rarity: c.rarity,
    imageUrl: cardImageUrl(c),
    colorIdentity: c.color_identity ?? [],
    finishes,
    printing: {
      scryfallId: c.id,
      setCode: c.set,
      collectorNumber: c.collector_number,
      label: printingLabel(c, packSet),
      foil: foilOnly,
    },
  }
}

export async function POST(req: NextRequest) {
  let packSet: string
  try {
    const { state } = await leagueContext()
    packSet = state.settings.packSet ?? 'trk'
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const body = await req.json().catch(() => null)
  const raw: unknown[] = Array.isArray(body?.numbers) ? body.numbers : []
  const typed = raw.filter((n): n is string => typeof n === 'string' && n.trim() !== '').map(n => n.trim())
  if (typed.length === 0) return NextResponse.json({ error: 'Enter at least one collector number' }, { status: 400 })
  if (typed.length > MAX_NUMBERS) return NextResponse.json({ error: `Up to ${MAX_NUMBERS} numbers at a time` }, { status: 400 })

  // Scryfall matches collector numbers case-sensitively, so a letter suffix is sent both ways ("1701D", "1701d").
  const identifiers = new Map<string, { set: string; collector_number: string }>()
  for (const n of typed) {
    const parsed = parsePackNumber(n, packSet)
    if (!parsed) continue
    for (const collector_number of new Set([parsed.number.toUpperCase(), parsed.number.toLowerCase()])) {
      identifiers.set(`${parsed.set}|${collector_number}`, { set: parsed.set, collector_number })
    }
  }

  let found: DeckScryfallCard[]
  try {
    found = identifiers.size ? await fetchBySetNumbers([...identifiers.values()]) as DeckScryfallCard[] : []
  } catch (err) {
    console.error('League number lookup failed:', err)
    return NextResponse.json({ error: 'Card lookup failed, try again' }, { status: 502 })
  }

  const byKey = new Map(found.map(c => [keyOf(c.set, c.collector_number), c]))
  const cards: PulledCardInput[] = []
  const notFound: string[] = []
  for (const n of typed) {
    const parsed = parsePackNumber(n, packSet)
    const card = parsed ? byKey.get(keyOf(parsed.set, parsed.number)) : undefined
    if (card) cards.push(toPull(card, packSet))
    else notFound.push(n)
  }
  return NextResponse.json({ cards, notFound })
}
