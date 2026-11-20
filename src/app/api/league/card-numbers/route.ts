import { NextRequest, NextResponse } from 'next/server'
import { fetchBySetNumbers, frameSuffix } from '@/lib/scryfall'
import { cardImageUrl, type DeckScryfallCard } from '@/lib/deck-ideas'
import { leagueContext } from '@/lib/league/store'
import { LeagueError, type PulledCardInput } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

const MAX_NUMBERS = 20

// Scryfall's collection lookup matches collector numbers exactly, so "042" must become "42".
function normalize(raw: string) {
  return raw.replace(/^#/, '').replace(/^0+(?=\d)/, '').toLowerCase()
}

function toPull(c: DeckScryfallCard): PulledCardInput & { finishes: string[] } {
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
      label: frameSuffix(c).replace(/[()]/g, '').trim() || 'Regular',
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

  const valid = typed.filter(n => /^\d+[a-z]*$/i.test(normalize(n)))
  const unique = [...new Set(valid.map(normalize))]

  let found: DeckScryfallCard[]
  try {
    found = unique.length ? await fetchBySetNumbers(packSet, unique) as DeckScryfallCard[] : []
  } catch (err) {
    console.error('League number lookup failed:', err)
    return NextResponse.json({ error: 'Card lookup failed, try again' }, { status: 502 })
  }

  const byNumber = new Map(found.map(c => [c.collector_number.toLowerCase(), c]))
  const cards: PulledCardInput[] = []
  const notFound: string[] = []
  for (const n of typed) {
    const card = byNumber.get(normalize(n))
    if (card) cards.push(toPull(card))
    else notFound.push(n)
  }
  return NextResponse.json({ cards, notFound })
}
