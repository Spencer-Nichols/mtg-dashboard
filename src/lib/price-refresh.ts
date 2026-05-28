import { createServiceClient } from '@/lib/supabase/service'
import { fetchByName, fetchById, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey, setCronTimestamp, CacheEntry } from '@/lib/cache'

const STALE_MS = 6 * 60 * 60 * 1000

function isStale(entry: CacheEntry | null): boolean {
  if (!entry) return true
  return Date.now() - entry.timestamp > STALE_MS
}

export interface RefreshResult {
  binderCount: number
  wishlistCount: number
  uniqueCards: number
  fetched: number
  fromCache: number
  usersUpdated: number
}

export async function refreshAllPrices(): Promise<RefreshResult> {
  const supabase = createServiceClient()

  const [{ data: binderRows }, { data: wishlistRows }] = await Promise.all([
    supabase.from('binder_cards').select('user_id, base_name, set_code, scryfall_id, foil, snapshot_price'),
    supabase.from('wishlist_singles').select('name, set_code, scryfall_id'),
  ])

  // Deduplicate by cache key so each unique card hits Scryfall at most once
  type CardRef = { baseName: string; setCode: string | null; scryfallId: string | null }
  const uniqueCards = new Map<string, CardRef>()

  for (const row of binderRows ?? []) {
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    if (!uniqueCards.has(key)) uniqueCards.set(key, { baseName: row.base_name, setCode: row.set_code, scryfallId: row.scryfall_id })
  }
  for (const row of wishlistRows ?? []) {
    const key = cacheKey(row.name, row.scryfall_id ?? row.set_code ?? '')
    if (!uniqueCards.has(key)) uniqueCards.set(key, { baseName: row.name, setCode: row.set_code, scryfallId: row.scryfall_id })
  }

  let fetched = 0
  let fromCache = 0
  let firstFetch = true

  for (const [key, card] of uniqueCards) {
    const existing = await getCached(key)
    if (!isStale(existing)) {
      fromCache++
      continue
    }

    if (!firstFetch) await sleep(card.scryfallId ? 150 : 600)
    firstFetch = false

    const scryfallCard = card.scryfallId
      ? await fetchById(card.scryfallId)
      : await fetchByName(card.baseName, card.setCode ?? undefined)

    if (scryfallCard) {
      const price = getPrice(scryfallCard, false)
      const foilPrice = getPrice(scryfallCard, true)
      const imageUrl = scryfallCard.image_uris?.normal ?? scryfallCard.card_faces?.[0]?.image_uris?.normal ?? null
      await setCached(key, price, foilPrice, imageUrl, {
        setName: scryfallCard.set_name ?? undefined,
        setCode: scryfallCard.set ?? undefined,
        rarity: scryfallCard.rarity ?? undefined,
        typeLine: scryfallCard.type_line ?? undefined,
      })
      fetched++
    }
  }

  // Calculate per-user binder totals and record history
  const userTotals = new Map<string, number>()
  for (const row of binderRows ?? []) {
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const price = row.foil ? (cached.foilPrice ?? cached.price) : cached.price
    if (price == null) continue
    userTotals.set(row.user_id, (userTotals.get(row.user_id) ?? 0) + price)
  }

  const today = new Date().toISOString().split('T')[0]
  for (const [userId, total] of userTotals) {
    await supabase.from('binder_history').upsert(
      { user_id: userId, date: today, total: parseFloat(total.toFixed(2)) },
      { onConflict: 'user_id,date' }
    )
  }

  await setCronTimestamp()

  return {
    binderCount: binderRows?.length ?? 0,
    wishlistCount: wishlistRows?.length ?? 0,
    uniqueCards: uniqueCards.size,
    fetched,
    fromCache,
    usersUpdated: userTotals.size,
  }
}
