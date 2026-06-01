import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const LISTINGS_URL = (productId) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=5214`

const MAX_SHIPPING = 25

const LISTINGS_BODY = {
  filters: {
    term: {
      sellerStatus: 'Live',
      channelId: 0,
      language: ['English'],
    },
    range: { quantity: { gte: 1 } },
  },
  from: 0,
  size: 5,
  sort: { field: 'price', order: 'asc' },
}

async function fetchLowestPrice(productId) {
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
  const listings = data?.results?.[0]?.results ?? []
  if (listings.length === 0) return null

  const valid = listings.filter(l => (l.shippingPrice ?? 0) <= MAX_SHIPPING)
  if (valid.length === 0) return null

  const lowest = Math.min(...valid.map(l => l.price))
  return parseFloat(lowest.toFixed(2))
}

const PRICE_MIN_DELTA = 0.25

async function main() {
  const { data: sealedRows, error } = await supabase
    .from('sealed_wishlist')
    .select('user_id, tcg_product_id')

  if (error) {
    console.error('Failed to fetch sealed wishlist:', error.message)
    process.exit(1)
  }

  if (!sealedRows || sealedRows.length === 0) {
    console.log('No sealed wishlist items found.')
    return
  }

  // Deduplicate product IDs
  const uniqueProductIds = [...new Set(sealedRows.map(r => r.tcg_product_id))]
  console.log(`Fetching prices for ${uniqueProductIds.length} unique products...`)

  const priceMap = new Map()
  const now = new Date().toISOString()

  for (const productId of uniqueProductIds) {
    const price = await fetchLowestPrice(productId)
    priceMap.set(productId, price)
    console.log(`  Product ${productId}: ${price != null ? `$${price}` : 'no listings'}`)
    await new Promise(r => setTimeout(r, 300))
  }

  // Fetch last recorded price per user+product to skip unchanged entries
  const { data: lastPrices } = await supabase
    .from('sealed_wishlist_history')
    .select('user_id, tcg_product_id, price')
    .in('tcg_product_id', uniqueProductIds)
    .order('recorded_at', { ascending: false })

  const lastPriceMap = new Map()
  for (const row of lastPrices ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    if (!lastPriceMap.has(key)) lastPriceMap.set(key, row.price)
  }

  // Only insert when price has changed by more than the minimum delta
  const historyRows = []
  for (const row of sealedRows) {
    const price = priceMap.get(row.tcg_product_id)
    if (price == null) continue
    const key = `${row.user_id}:${row.tcg_product_id}`
    const lastPrice = lastPriceMap.get(key)
    if (lastPrice != null && Math.abs(price - lastPrice) < PRICE_MIN_DELTA) continue
    historyRows.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, recorded_at: now, price })
  }

  if (historyRows.length === 0) {
    console.log('No price changes to write.')
  } else {
    const { error: insertError } = await supabase
      .from('sealed_wishlist_history')
      .insert(historyRows)

    if (insertError) {
      console.error('Failed to write history:', insertError.message)
      process.exit(1)
    }

    console.log(`Wrote ${historyRows.length} price entries (${sealedRows.length - historyRows.length} unchanged).`)
  }

  // --- ATL notification dedup ---
  const ATL_WINDOW_MS = 24 * 60 * 60 * 1000
  const atlCutoff = new Date(Date.now() - ATL_WINDOW_MS).toISOString()

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

  const lastNotifMap = new Map()
  for (const row of lastNotifications ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    if (!lastNotifMap.has(key)) lastNotifMap.set(key, row.notified_price)
  }

  // Group older history by user+product
  const olderPricesMap = new Map()
  for (const row of allHistory ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    const arr = olderPricesMap.get(key) ?? []
    arr.push(row.price)
    olderPricesMap.set(key, arr)
  }

  const atlRows = []
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
    atlRows.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, notified_price: price, notified_at: now })
    console.log(`  ATL: product ${row.tcg_product_id} for user ${row.user_id} at $${price} (historic low was $${historicLow})`)
  }

  if (atlRows.length === 0) {
    console.log('No new ATL events.')
    return
  }

  const { error: atlError } = await supabase
    .from('sealed_atl_notifications')
    .insert(atlRows)

  if (atlError) {
    console.error('Failed to write ATL notifications:', atlError.message)
    process.exit(1)
  }

  console.log(`Recorded ${atlRows.length} ATL notification(s) — ready to send emails when Resend is wired up.`)
}

main()
