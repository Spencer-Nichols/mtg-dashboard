import { cacheKey, getCachedMany, setCached, type CacheEntry } from '@/lib/cache'
import { cardImageUrl, collectInBatches, type DeckScryfallCard, type Identifier } from '@/lib/deck-ideas'
import type { LeagueCard, LeagueState } from './types'

const PRECON_SET = 'trc'

export type PriceMap = Map<string, number | null>

function keyFor(c: LeagueCard) {
  return c.printing
    ? cacheKey(c.name, `${c.printing.setCode}#${c.printing.collectorNumber}`)
    : cacheKey(c.name, PRECON_SET)
}

function pick(entry: CacheEntry | null | undefined, foil: boolean) {
  if (!entry) return null
  return foil ? entry.foilPrice ?? entry.price : entry.price ?? entry.foilPrice
}

function cacheCard(key: string, card: DeckScryfallCard, writes: Promise<unknown>[]) {
  const num = (v?: string | null) => v ? parseFloat(v) : null
  writes.push(setCached(key, num(card.prices.usd), num(card.prices.usd_foil), cardImageUrl(card), {
    setName: card.set_name,
    setCode: card.set,
    rarity: card.rarity,
    typeLine: card.type_line,
    etchedPrice: num(card.prices.usd_etched),
  }))
  return { price: num(card.prices.usd), foilPrice: num(card.prices.usd_foil) } as CacheEntry
}

export async function priceLeagueCards(state: LeagueState): Promise<PriceMap> {
  const byKey = new Map<string, LeagueCard>()
  for (const c of state.cards) if (!byKey.has(keyFor(c))) byKey.set(keyFor(c), c)
  const keys = [...byKey.keys()]

  let cached: (CacheEntry | null)[] = []
  try {
    cached = await getCachedMany(keys)
  } catch (err) {
    console.error('League price cache read failed:', err)
  }
  const entries = new Map(keys.map((k, i) => [k, cached[i] ?? null]))

  const missing = keys.filter(k => !entries.get(k))
  if (missing.length > 0) {
    const writes: Promise<unknown>[] = []
    try {
      const printed = missing.filter(k => byKey.get(k)!.printing)
      const precon = missing.filter(k => !byKey.get(k)!.printing)

      const byId = new Map((await collectInBatches(printed.map(k => ({ id: byKey.get(k)!.printing!.scryfallId }) as Identifier)))
        .map(card => [card.id, card]))
      for (const k of printed) {
        const card = byId.get(byKey.get(k)!.printing!.scryfallId)
        if (card) entries.set(k, cacheCard(k, card, writes))
      }

      const lower = (s: string) => s.toLowerCase()
      const inSet = new Map((await collectInBatches(precon.map(k => ({ name: byKey.get(k)!.name, set: PRECON_SET }))))
        .map(card => [lower(card.name), card]))
      const fallback = precon.filter(k => !inSet.has(lower(byKey.get(k)!.name)))
      const anySet = new Map((await collectInBatches(fallback.map(k => ({ name: byKey.get(k)!.name }))))
        .map(card => [lower(card.name), card]))
      for (const k of precon) {
        const name = lower(byKey.get(k)!.name)
        const card = inSet.get(name) ?? anySet.get(name)
        if (card) entries.set(k, cacheCard(k, card, writes))
      }
      for (const k of missing) if (!entries.get(k)) writes.push(setCached(k, null, null, null))
      await Promise.all(writes)
    } catch (err) {
      console.error('League price lookup failed:', err)
    }
  }

  return new Map(state.cards.map(c => [c.id, pick(entries.get(keyFor(c)), c.printing?.foil ?? false)]))
}
