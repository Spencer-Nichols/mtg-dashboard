import { fetchByNameChecked, searchCardsChecked, type ScryfallCard } from '@/lib/scryfall'
import { getCachedPublicCard, setCachedPublicCard, publicCardCacheKey } from '@/lib/cache'
import { collectInBatches } from '@/lib/deck-ideas'

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

export const BULK_LOOKUP_MAX = 75

function compactFace(name: string, manaCost: string | undefined, typeLine: string | undefined, oracle: string | undefined, stats: string) {
  const header = [name, manaCost || null, typeLine ?? null, stats || null].filter(Boolean).join(' | ')
  return oracle ? `${header}\n${oracle}` : header
}

function statsOf(c: { power?: string; toughness?: string; loyalty?: string }) {
  if (c.power !== undefined) return `${c.power}/${c.toughness}`
  if (c.loyalty !== undefined) return `Loyalty ${c.loyalty}`
  return ''
}

// One short text block per card, so a whole decklist fits in an LLM's context.
export function compactCard(card: ScryfallCard) {
  if (card.oracle_text !== undefined || !card.card_faces?.length) {
    return compactFace(card.name, card.mana_cost, card.type_line, card.oracle_text, statsOf(card))
  }
  return card.card_faces
    .map(face => compactFace(face.name, face.mana_cost, (face as { type_line?: string }).type_line, face.oracle_text, statsOf(face as { power?: string; toughness?: string; loyalty?: string })))
    .join('\n// ')
}

// Exact-name lookup in batches of 75 via Scryfall's /cards/collection.
export async function lookupManyCards(names: string[]) {
  const unique = [...new Map(names.map(n => [n.trim().toLowerCase(), n.trim()])).values()].filter(Boolean).slice(0, BULK_LOOKUP_MAX)
  const cards = await collectInBatches(unique.map(name => ({ name })))
  const byName = new Map<string, ScryfallCard>()
  for (const card of cards) {
    const full = card.name.toLowerCase()
    byName.set(full, card)
    byName.set(full.split(' // ')[0], card)
  }
  const found = unique.map(n => byName.get(n.toLowerCase())).filter((c): c is ScryfallCard => !!c)
  const notFound = unique.filter(n => !byName.has(n.toLowerCase()))
  return { found: [...new Set(found)], notFound }
}
