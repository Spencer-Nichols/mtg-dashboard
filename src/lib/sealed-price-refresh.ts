import { createServiceClient } from '@/lib/supabase/service'

const LISTINGS_URL = (productId: number) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=5214`

const MAX_SHIPPING = 25
const PRICE_MIN_DELTA = 0.25

const LISTINGS_BODY = {
  filters: {
    term: { sellerStatus: 'Live', channelId: 0, language: ['English'] },
    range: { quantity: { gte: 1 } },
  },
  from: 0,
  size: 5,
  sort: { field: 'price', order: 'asc' },
}

async function fetchLowestPrice(productId: number): Promise<number | null> {
  const res = await fetch(LISTINGS_URL(productId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://www.tcgplayer.com',
      'Referer': `https://www.tcgplayer.com/product/${productId}`,
    },
    body: JSON.stringify(LISTINGS_BODY),
  })

  if (!res.ok) return null

  const data = await res.json()
  const listings: Array<{ price: number; shippingPrice?: number }> = data?.results?.[0]?.results ?? []
  if (listings.length === 0) return null

  const valid = listings.filter(l => (l.shippingPrice ?? 0) <= MAX_SHIPPING)
  if (valid.length === 0) return null

  return parseFloat(Math.min(...valid.map(l => l.price)).toFixed(2))
}

export interface SealedRefreshResult {
  products: number
  pricesFetched: number
  historyRows: number
  atlRows: number
}

export async function refreshSealedPrices(): Promise<SealedRefreshResult> {
  const supabase = createServiceClient()

  const { data: sealedRows, error } = await supabase
    .from('sealed_wishlist')
    .select('user_id, tcg_product_id')

  if (error) throw new Error(`Failed to fetch sealed wishlist: ${error.message}`)
  if (!sealedRows || sealedRows.length === 0) {
    return { products: 0, pricesFetched: 0, historyRows: 0, atlRows: 0 }
  }

  const uniqueProductIds = [...new Set(sealedRows.map(r => r.tcg_product_id))] as number[]
  const priceMap = new Map<number, number | null>()
  const now = new Date().toISOString()

  for (const productId of uniqueProductIds) {
    priceMap.set(productId, await fetchLowestPrice(productId))
    await new Promise(r => setTimeout(r, 300))
  }

  const pricesFetched = [...priceMap.values()].filter(p => p != null).length

  const { data: lastPrices } = await supabase
    .from('sealed_wishlist_history')
    .select('user_id, tcg_product_id, price')
    .in('tcg_product_id', uniqueProductIds)
    .order('recorded_at', { ascending: false })

  const lastPriceMap = new Map<string, number>()
  for (const row of lastPrices ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    if (!lastPriceMap.has(key)) lastPriceMap.set(key, row.price)
  }

  const historyInserts: { user_id: string; tcg_product_id: number; recorded_at: string; price: number }[] = []
  for (const row of sealedRows) {
    const price = priceMap.get(row.tcg_product_id)
    if (price == null) continue
    const key = `${row.user_id}:${row.tcg_product_id}`
    const lastPrice = lastPriceMap.get(key)
    if (lastPrice != null && Math.abs(price - lastPrice) < PRICE_MIN_DELTA) continue
    historyInserts.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, recorded_at: now, price })
  }

  if (historyInserts.length > 0) {
    const { error: insertError } = await supabase.from('sealed_wishlist_history').insert(historyInserts)
    if (insertError) throw new Error(`Failed to write history: ${insertError.message}`)
  }

  // ATL notifications
  const atlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: allHistory } = await supabase
    .from('sealed_wishlist_history')
    .select('user_id, tcg_product_id, price, recorded_at')
    .in('tcg_product_id', uniqueProductIds)
    .lt('recorded_at', atlCutoff)

  const { data: lastNotifications } = await supabase
    .from('sealed_atl_notifications')
    .select('user_id, tcg_product_id, notified_price')
    .in('tcg_product_id', uniqueProductIds)
    .order('notified_at', { ascending: false })

  const lastNotifMap = new Map<string, number>()
  for (const row of lastNotifications ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    if (!lastNotifMap.has(key)) lastNotifMap.set(key, row.notified_price)
  }

  const olderPricesMap = new Map<string, number[]>()
  for (const row of allHistory ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    const arr = olderPricesMap.get(key) ?? []
    arr.push(row.price)
    olderPricesMap.set(key, arr)
  }

  const atlInserts: { user_id: string; tcg_product_id: number; notified_price: number; notified_at: string }[] = []
  for (const row of sealedRows) {
    const price = priceMap.get(row.tcg_product_id)
    if (price == null) continue
    const key = `${row.user_id}:${row.tcg_product_id}`
    const olderPrices = olderPricesMap.get(key) ?? []
    if (olderPrices.length === 0) continue
    const historicLow = Math.min(...olderPrices)
    if (price >= historicLow) continue
    const lastNotifPrice = lastNotifMap.get(key)
    if (lastNotifPrice != null && price >= lastNotifPrice) continue
    atlInserts.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, notified_price: price, notified_at: now })
  }

  if (atlInserts.length > 0) {
    const { error: atlError } = await supabase.from('sealed_atl_notifications').insert(atlInserts)
    if (atlError) throw new Error(`Failed to write ATL notifications: ${atlError.message}`)
  }

  return { products: uniqueProductIds.length, pricesFetched, historyRows: historyInserts.length, atlRows: atlInserts.length }
}
