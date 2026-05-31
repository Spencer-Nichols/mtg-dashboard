import { createServiceClient } from '@/lib/supabase/service'
import { fetchByName, fetchById, getPrice, sleep } from '@/lib/scryfall'
import { getCached, setCached, cacheKey, setCronTimestamp, setSealedPrice, CacheEntry } from '@/lib/cache'
import { fetchGroupPrices } from '@/lib/tcgcsv'

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
    supabase.from('binder_cards').select('user_id, display_name, base_name, set_code, scryfall_id, foil, snapshot_price'),
    supabase.from('wishlist_singles').select('user_id, name, set_code, scryfall_id'),
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

  // Calculate per-user binder totals, card counts, and per-card history
  const userTotals = new Map<string, number>()
  const userCounts = new Map<string, number>()
  const binderCardHistory: { user_id: string; display_name: string; date: string; price: number }[] = []

  const today = new Date().toISOString().split('T')[0]

  for (const row of binderRows ?? []) {
    userCounts.set(row.user_id, (userCounts.get(row.user_id) ?? 0) + 1)
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const price = row.foil ? (cached.foilPrice ?? cached.price) : cached.price
    if (price == null) continue
    userTotals.set(row.user_id, (userTotals.get(row.user_id) ?? 0) + price)
    binderCardHistory.push({ user_id: row.user_id, display_name: row.display_name, date: today, price: parseFloat(price.toFixed(2)) })
  }

  const HISTORY_MIN_DELTA = 0.25

  for (const [userId, total] of userTotals) {
    const newTotal = parseFloat(total.toFixed(2))
    const { data: lastEntry } = await supabase
      .from('binder_history')
      .select('total')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastTotal = lastEntry?.total ?? null
    if (lastTotal === null || Math.abs(newTotal - lastTotal) >= HISTORY_MIN_DELTA) {
      await supabase.from('binder_history').insert({
        user_id: userId,
        date: today,
        total: newTotal,
        card_count: userCounts.get(userId) ?? null,
      })
    }
  }

  if (binderCardHistory.length > 0) {
    await supabase.from('binder_card_history').upsert(binderCardHistory, { onConflict: 'user_id,display_name,date' })
  }

  // Per-card wishlist history
  const wishlistCardHistory: { user_id: string; card_name: string; date: string; price: number }[] = []
  for (const row of wishlistRows ?? []) {
    const key = cacheKey(row.name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    if (!cached || cached.price == null) continue
    wishlistCardHistory.push({ user_id: row.user_id, card_name: row.name, date: today, price: parseFloat(cached.price.toFixed(2)) })
  }

  if (wishlistCardHistory.length > 0) {
    await supabase.from('wishlist_card_history').upsert(wishlistCardHistory, { onConflict: 'user_id,card_name,date' })
  }

  // Refresh sealed product prices from TCGCSV (one request per set)
  const { data: sealedRows } = await supabase
    .from('sealed_wishlist')
    .select('user_id, tcg_product_id, tcg_group_id')

  if (sealedRows && sealedRows.length > 0) {
    const byGroup = new Map<number, number[]>()
    for (const row of sealedRows) {
      const ids = byGroup.get(row.tcg_group_id) ?? []
      ids.push(row.tcg_product_id)
      byGroup.set(row.tcg_group_id, ids)
    }

    const sealedHistoryRows: { user_id: string; tcg_product_id: number; date: string; price: number }[] = []

    for (const [groupId, productIds] of byGroup) {
      const prices = await fetchGroupPrices(groupId)
      for (const productId of productIds) {
        const price = prices.get(productId) ?? null
        await setSealedPrice(productId, price)
        if (price != null) {
          const usersWithProduct = sealedRows.filter(r => r.tcg_product_id === productId)
          for (const row of usersWithProduct) {
            sealedHistoryRows.push({ user_id: row.user_id, tcg_product_id: productId, date: today, price: parseFloat(price.toFixed(2)) })
          }
        }
      }
    }

    if (sealedHistoryRows.length > 0) {
      await supabase.from('sealed_wishlist_history').upsert(sealedHistoryRows, { onConflict: 'user_id,tcg_product_id,date' })
    }
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
