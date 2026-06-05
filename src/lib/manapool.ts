const SINGLES_URL = (ids: string[]) =>
  `https://manapool.com/api/v1/products/singles?${ids.map(id => `scryfall_ids=${id}`).join('&')}`

export interface ManapoolSinglePrice {
  price: number | null
  foilPrice: number | null
  etchedPrice: number | null
  url: string
}

function bestLowPrice(variants: any[], finishId: string): number | null {
  const acceptable = ['NM', 'LP']
  const candidates = variants?.filter(
    v => v.finish_id === finishId && acceptable.includes(v.condition_id) && v.available_quantity > 0 && v.low_price > 0
  ) ?? []
  if (candidates.length === 0) return null
  return Math.min(...candidates.map(v => v.low_price))
}

function cents(val: number | null): number | null {
  return val != null ? parseFloat((val / 100).toFixed(2)) : null
}

export async function fetchManapoolSinglePrices(scryfallIds: string[]): Promise<Map<string, ManapoolSinglePrice>> {
  const map = new Map<string, ManapoolSinglePrice>()
  if (scryfallIds.length === 0) return map

  const BATCH = 100
  for (let i = 0; i < scryfallIds.length; i += BATCH) {
    const batch = scryfallIds.slice(i, i + BATCH)
    try {
      const res = await fetch(SINGLES_URL(batch))
      if (!res.ok) {
        console.error(`Manapool singles API error: ${res.status}`, await res.text().catch(() => ''))
        continue
      }
      const data = await res.json()
      for (const item of data?.data ?? []) {
        if (!item.scryfall_id) continue
        map.set(item.scryfall_id, {
          price:        cents(bestLowPrice(item.variants, 'NF') ?? item.price_cents),
          foilPrice:    cents(bestLowPrice(item.variants, 'FO') ?? item.price_cents_foil),
          etchedPrice:  cents(bestLowPrice(item.variants, 'ET') ?? item.price_cents_etched),
          url: item.url,
        })
      }
    } catch {
      // non-fatal — Scryfall prices will be used as fallback
    }
  }
  return map
}
