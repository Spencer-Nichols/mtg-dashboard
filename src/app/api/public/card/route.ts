import { NextRequest, NextResponse } from 'next/server'
import { fetchByName, searchCards, type ScryfallCard } from '@/lib/scryfall'

export const dynamic = 'force-dynamic'

function curate(card: ScryfallCard) {
  return {
    name: card.name,
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? null,
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    faces: card.card_faces?.map(f => ({
      name: f.name,
      manaCost: f.mana_cost ?? null,
      oracleText: f.oracle_text ?? null,
      imageUrl: f.image_uris?.normal ?? null,
    })) ?? null,
    set: {
      code: card.set,
      name: card.set_name,
      collectorNumber: card.collector_number,
      rarity: card.rarity,
      releasedAt: card.released_at,
    },
    prices: {
      usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
      usdFoil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
      usdEtched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : null,
    },
    imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
  }
}

function curateCandidate(card: ScryfallCard) {
  return {
    name: card.name,
    setCode: card.set,
    setName: card.set_name,
    typeLine: card.type_line,
    price: card.prices.usd ? parseFloat(card.prices.usd) : null,
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 })

  const set = req.nextUrl.searchParams.get('set')?.trim() || undefined

  const card = await fetchByName(q, set)
  if (card) return NextResponse.json({ card: curate(card), candidates: null })

  const candidates = await searchCards(q)
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No cards found' }, { status: 404 })
  }
  if (candidates.length === 1) {
    return NextResponse.json({ card: curate(candidates[0]), candidates: null })
  }
  return NextResponse.json({ card: null, candidates: candidates.map(curateCandidate) })
}
