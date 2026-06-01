import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const LISTINGS_URL = (productId) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=5214`

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
  size: 1,
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

  const listing = listings[0]
  return parseFloat((listing.price + (listing.shippingPrice ?? 0)).toFixed(2))
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
    return
  }

  const { error: insertError } = await supabase
    .from('sealed_wishlist_history')
    .insert(historyRows)

  if (insertError) {
    console.error('Failed to write history:', insertError.message)
    process.exit(1)
  }

  console.log(`Wrote ${historyRows.length} price entries (${sealedRows.length - historyRows.length} unchanged).`)
}

main()
