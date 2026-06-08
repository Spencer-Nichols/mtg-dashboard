const LISTINGS_URL = (productId: number) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=5214`

const LISTINGS_BODY = {
  filters: {
    term: { sellerStatus: 'Live', channelId: 0, language: ['English'] },
    range: { quantity: { gte: 1 } },
  },
  from: 0,
  size: 5,
  sort: { field: 'price', order: 'asc' },
}

const MAX_SHIPPING = 25

export async function fetchTcgPlayerPrice(productId: number): Promise<number | null> {
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
