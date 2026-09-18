import { NextRequest, NextResponse } from 'next/server'
import { fetchByNameChecked, searchCardsChecked, ScryfallRateLimitError, type ScryfallCard } from '@/lib/scryfall'
import { getCachedPublicCard, setCachedPublicCard, publicCardCacheKey } from '@/lib/cache'

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

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }
const RATE_LIMITED_HEADERS = { 'Cache-Control': 'no-store, max-age=0', 'Retry-After': '5' }

type PublicCardResponse =
  | { card: ReturnType<typeof curate>; candidates: null }
  | { card: null; candidates: ReturnType<typeof curateCandidate>[] }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing query param: q' }, { status: 400, headers: NO_STORE_HEADERS })

  const set = req.nextUrl.searchParams.get('set')?.trim() || undefined

  const cacheKey = publicCardCacheKey(q, set)
  const cached = await getCachedPublicCard<PublicCardResponse>(cacheKey)
  if (cached) return NextResponse.json(cached, { headers: NO_STORE_HEADERS })

  let body: PublicCardResponse
  try {
    const card = await fetchByNameChecked(q, set)
    if (card) {
      body = { card: curate(card), candidates: null }
    } else {
      const candidates = await searchCardsChecked(q)
      if (candidates.length === 0) {
        return NextResponse.json({ error: 'No cards found' }, { status: 404, headers: NO_STORE_HEADERS })
      }
      body = candidates.length === 1
        ? { card: curate(candidates[0]), candidates: null }
        : { card: null, candidates: candidates.map(curateCandidate) }
    }
  } catch (err) {
    if (err instanceof ScryfallRateLimitError) {
      return NextResponse.json({ error: 'Rate limited, try again shortly' }, { status: 503, headers: RATE_LIMITED_HEADERS })
    }
    throw err
  }

  await setCachedPublicCard(cacheKey, body)
  return NextResponse.json(body, { headers: NO_STORE_HEADERS })
}
