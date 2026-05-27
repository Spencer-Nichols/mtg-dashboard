import { NextRequest, NextResponse } from 'next/server'
import { fetchByName, fetchById, searchCards, searchPrintings } from '@/lib/scryfall'
import { getCollectionStatus } from '@/lib/collection'

const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0' }

export async function GET(req: NextRequest) {
  // Random card mode
  if (req.nextUrl.searchParams.get('random') === 'true') {
    const res = await fetch('https://api.scryfall.com/cards/random', { headers: HEADERS })
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch random card' }, { status: 500 })
    const card = await res.json()
    const status = getCollectionStatus(card.name)
    return NextResponse.json({ card, status, candidates: null })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  // Printings mode — all printings of a specific card name
  if (req.nextUrl.searchParams.get('prints') === 'true') {
    const cards = await searchPrintings(q)
    return NextResponse.json(cards.map(c => ({
      scryfallId: c.id,
      name: c.name,
      setCode: c.set,
      setName: c.set_name,
      price: c.prices.usd ? parseFloat(c.prices.usd) : null,
      foilPrice: c.prices.usd_foil ? parseFloat(c.prices.usd_foil) : null,
      type_line: c.type_line,
      collectorNumber: c.collector_number,
      rarity: c.rarity,
      releasedAt: c.released_at,
      imageUrl: c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null,
    })))
  }

  // Candidate-list mode for dropdowns — always returns array
  if (req.nextUrl.searchParams.get('candidates') === 'true') {
    const cards = await searchCards(q)
    return NextResponse.json(cards.map(c => ({
      name: c.name,
      setCode: c.set,
      setName: c.set_name,
      price: c.prices.usd ? parseFloat(c.prices.usd) : null,
      type_line: c.type_line,
    })))
  }

  // Try exact fuzzy match first
  const card = await fetchByName(q)
  if (card) {
    const status = getCollectionStatus(card.name)
    return NextResponse.json({ card, status, candidates: null })
  }

  // Fall back to search — return candidates for user to pick from
  const candidates = await searchCards(q)
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No cards found' }, { status: 404 })
  }

  // If only one result, return it directly
  if (candidates.length === 1) {
    const status = getCollectionStatus(candidates[0].name)
    return NextResponse.json({ card: candidates[0], status, candidates: null })
  }

  return NextResponse.json({ card: null, candidates })
}
