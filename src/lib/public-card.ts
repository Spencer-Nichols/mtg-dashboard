import { fetchByNameChecked, searchCardsChecked, type ScryfallCard } from '@/lib/scryfall'
import { getCachedPublicCard, setCachedPublicCard, publicCardCacheKey } from '@/lib/cache'

export function curate(card: ScryfallCard) {
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

export function curateCandidate(card: ScryfallCard) {
  return {
    name: card.name,
    setCode: card.set,
    setName: card.set_name,
    typeLine: card.type_line,
    price: card.prices.usd ? parseFloat(card.prices.usd) : null,
  }
}

export type PublicCardResponse =
  | { card: ReturnType<typeof curate>; candidates: null }
  | { card: null; candidates: ReturnType<typeof curateCandidate>[] }

// Shared by /api/public/card and the public MCP. Returns null when nothing matches.
// Throws ScryfallRateLimitError when Scryfall rate limits us.
export async function lookupPublicCard(query: string, setCode?: string): Promise<PublicCardResponse | null> {
  const cacheKey = publicCardCacheKey(query, setCode)
  const cached = await getCachedPublicCard<PublicCardResponse>(cacheKey)
  if (cached) return cached

  let body: PublicCardResponse
  const card = await fetchByNameChecked(query, setCode)
  if (card) {
    body = { card: curate(card), candidates: null }
  } else {
    const candidates = await searchCardsChecked(query)
    if (candidates.length === 0) return null
    body = candidates.length === 1
      ? { card: curate(candidates[0]), candidates: null }
      : { card: null, candidates: candidates.map(curateCandidate) }
  }

  await setCachedPublicCard(cacheKey, body)
  return body
}
