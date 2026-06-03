import { createServiceClient } from '@/lib/supabase/service'
import { setSealedCronTimestamp } from '@/lib/cache'

const LISTINGS_URL = (productId: number) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=5214`

const MANAPOOL_URL = (ids: number[]) =>
  `https://manapool.com/api/v1/products/sealed?tcgplayer_ids=${ids.join(',')}`

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

async function fetchTcgPlayerPrice(productId: number): Promise<number | null> {
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

  return parseFloat(Math.min(...valid.map(l => l.price + (l.shippingPrice ?? 0))).toFixed(2))
}

async function fetchManaPoolPrices(productIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (productIds.length === 0) return map

  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100)
    try {
      const res = await fetch(MANAPOOL_URL(batch))
      if (!res.ok) continue
      const data = await res.json()
      for (const item of data?.data ?? []) {
        if (item.tcgplayer_product_id != null && item.low_price != null) {
          map.set(item.tcgplayer_product_id, parseFloat((item.low_price / 100).toFixed(2)))
        }
      }
    } catch {
      // non-fatal — TCGPlayer will cover missing products
    }
  }
  return map
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
    .select('user_id, tcg_product_id, snapshot_price, target_price')

  if (error) throw new Error(`Failed to fetch sealed wishlist: ${error.message}`)
  if (!sealedRows || sealedRows.length === 0) {
    return { products: 0, pricesFetched: 0, historyRows: 0, atlRows: 0 }
  }

  const uniqueProductIds = [...new Set(sealedRows.map(r => Number(r.tcg_product_id)))]
  const now = new Date().toISOString()

  // Fetch Manapool prices (one batch request) and TCGPlayer prices (sequential) in parallel
  const [manapoolPrices, tcgPrices] = await Promise.all([
    fetchManaPoolPrices(uniqueProductIds),
    (async () => {
      const map = new Map<number, number | null>()
      for (const productId of uniqueProductIds) {
        map.set(productId, await fetchTcgPlayerPrice(productId))
        await new Promise(r => setTimeout(r, 300))
      }
      return map
    })(),
  ])

  // For each product, take the lower of the two prices and track the source
  const priceMap = new Map<number, number | null>()
  const sourceMap = new Map<number, 'manapool' | 'tcgplayer'>()
  for (const productId of uniqueProductIds) {
    const mp = manapoolPrices.get(productId) ?? null
    const tcg = tcgPrices.get(productId) ?? null
    if (mp == null && tcg == null) {
      priceMap.set(productId, null)
    } else if (mp == null) {
      priceMap.set(productId, tcg)
      sourceMap.set(productId, 'tcgplayer')
    } else if (tcg == null) {
      priceMap.set(productId, mp)
      sourceMap.set(productId, 'manapool')
    } else {
      const lower = Math.min(mp, tcg)
      priceMap.set(productId, lower)
      sourceMap.set(productId, lower === mp ? 'manapool' : 'tcgplayer')
    }
  }

  const pricesFetched = [...priceMap.values()].filter(p => p != null).length

  const { data: lastPrices } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, price')
    .in('tcg_product_id', uniqueProductIds)
    .order('recorded_at', { ascending: false })

  const lastPriceMap = new Map<number, number>()
  for (const row of lastPrices ?? []) {
    if (!lastPriceMap.has(row.tcg_product_id)) lastPriceMap.set(row.tcg_product_id, row.price)
  }

  const historyInserts: { tcg_product_id: number; recorded_at: string; price: number; price_source: string }[] = []
  for (const productId of uniqueProductIds) {
    const price = priceMap.get(productId)
    if (price == null) continue
    const lastPrice = lastPriceMap.get(productId)
    if (lastPrice != null && Math.abs(price - lastPrice) < PRICE_MIN_DELTA) continue
    historyInserts.push({
      tcg_product_id: productId,
      recorded_at: now,
      price,
      price_source: sourceMap.get(productId) ?? 'tcgplayer',
    })
  }

  if (historyInserts.length > 0) {
    const { error: insertError } = await supabase.from('sealed_wishlist_history').insert(historyInserts)
    if (insertError) throw new Error(`Failed to write history: ${insertError.message}`)
  }

  // ATL notifications
  const atlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: allHistory } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, price, recorded_at')
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

  const olderPricesMap = new Map<number, number[]>()
  for (const row of allHistory ?? []) {
    const arr = olderPricesMap.get(row.tcg_product_id) ?? []
    arr.push(row.price)
    olderPricesMap.set(row.tcg_product_id, arr)
  }

  const atlInserts: { user_id: string; tcg_product_id: number; notified_price: number; notified_at: string }[] = []
  for (const row of sealedRows) {
    const price = priceMap.get(row.tcg_product_id)
    if (price == null) continue
    const key = `${row.user_id}:${row.tcg_product_id}`
    const olderPrices = olderPricesMap.get(row.tcg_product_id) ?? []
    const snapshotPrice = row.snapshot_price ?? 0
    const targetPrice = row.target_price as number | null
    const baseline = olderPrices.length > 0 ? Math.min(...olderPrices, snapshotPrice) : snapshotPrice
    const meetsBaseline = baseline - price >= 2
    const meetsTarget = targetPrice != null && price <= targetPrice
    if (!meetsBaseline && !meetsTarget) continue
    const lastNotifPrice = lastNotifMap.get(key)
    if (lastNotifPrice != null && price >= lastNotifPrice) continue
    atlInserts.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, notified_price: price, notified_at: now })
  }

  if (atlInserts.length > 0) {
    const { error: atlError } = await supabase.from('sealed_atl_notifications').insert(atlInserts)
    if (atlError) throw new Error(`Failed to write ATL notifications: ${atlError.message}`)
  }

  await setSealedCronTimestamp()

  return { products: uniqueProductIds.length, pricesFetched, historyRows: historyInserts.length, atlRows: atlInserts.length }
}
