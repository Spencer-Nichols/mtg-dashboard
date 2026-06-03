const SINGLES_URL = (ids: string[]) =>
  `https://manapool.com/api/v1/products/singles?scryfall_ids=${ids.join(',')}`

export interface ManapoolSinglePrice {
  price: number | null
  foilPrice: number | null
  etchedPrice: number | null
  url: string
}

export async function fetchManapoolSinglePrices(scryfallIds: string[]): Promise<Map<string, ManapoolSinglePrice>> {
  const map = new Map<string, ManapoolSinglePrice>()
  if (scryfallIds.length === 0) return map

  const BATCH = 100
  for (let i = 0; i < scryfallIds.length; i += BATCH) {
    const batch = scryfallIds.slice(i, i + BATCH)
    try {
      const res = await fetch(SINGLES_URL(batch))
      if (!res.ok) continue
      const data = await res.json()
      for (const item of data?.data ?? []) {
        if (!item.scryfall_id) continue
        map.set(item.scryfall_id, {
          price: item.price_cents != null ? parseFloat((item.price_cents / 100).toFixed(2)) : null,
          foilPrice: item.price_cents_foil != null ? parseFloat((item.price_cents_foil / 100).toFixed(2)) : null,
          etchedPrice: item.price_cents_etched != null ? parseFloat((item.price_cents_etched / 100).toFixed(2)) : null,
          url: item.url,
        })
      }
    } catch {
      // non-fatal — Scryfall prices will be used as fallback
    }
  }
  return map
}
