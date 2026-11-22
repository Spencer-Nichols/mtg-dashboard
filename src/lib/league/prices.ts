import { createServiceClient } from '@/lib/supabase/service'
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

const HISTORY_TABLE = 'league_card_history'

// Same 'YYYY-MM-DDTHH' 4-hour buckets the wishlist history uses.
function priceBucket(now = new Date()) {
  const day = now.toISOString().split('T')[0]
  const hour = String(Math.floor(now.getUTCHours() / 4) * 4).padStart(2, '0')
  return `${day}T${hour}`
}

// Called by the price refresh cron: one row per pulled printing, foil and non-foil price side by side.
export async function recordPullPrices(state: LeagueState) {
  const printed = new Map<string, string>()
  for (const c of state.cards) {
    if (c.origin === 'pull' && c.printing) printed.set(keyFor(c), c.printing.scryfallId)
  }
  if (printed.size === 0) return { recorded: 0 }

  const byId = new Map((await collectInBatches([...printed.values()].map(id => ({ id }) as Identifier))).map(card => [card.id, card]))
  const date = priceBucket()
  const num = (v?: string | null) => v ? parseFloat(v) : null
  const rows = [...printed.entries()].flatMap(([key, id]) => {
    const card = byId.get(id)
    return card ? [{ card_key: key, date, price: num(card.prices.usd), foil_price: num(card.prices.usd_foil) }] : []
  })
  const { error } = await createServiceClient().from(HISTORY_TABLE).upsert(rows, { onConflict: 'card_key,date' })
  if (error) throw error
  return { recorded: rows.length }
}

export async function pullHistory(cards: LeagueCard[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>()
  const keys = [...new Set(cards.map(keyFor))]
  if (keys.length === 0) return result
  const { data, error } = await createServiceClient()
    .from(HISTORY_TABLE)
    .select('card_key, date, price, foil_price')
    .in('card_key', keys)
    .order('date', { ascending: true })
  if (error) {
    console.error('League price history read failed:', error)
    return result
  }
  for (const c of cards) {
    const foil = c.printing?.foil ?? false
    const points = (data ?? [])
      .filter(r => r.card_key === keyFor(c))
      .map(r => Number(foil ? r.foil_price ?? r.price : r.price ?? r.foil_price))
      .filter(n => Number.isFinite(n) && n > 0)
    result.set(c.id, points)
  }
  return result
}
