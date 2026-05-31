const BASE = 'https://tcgcsv.com/tcgplayer/1'

export interface TcgGroup {
  groupId: number
  name: string
  abbreviation: string
  publishedOn: string
}

export interface TcgProduct {
  productId: number
  name: string
  imageUrl: string | null
  groupId: number
}

export interface TcgPrice {
  productId: number
  lowPrice: number | null
  midPrice: number | null
  highPrice: number | null
  marketPrice: number | null
  subTypeName: string
}

const SEALED_KEYWORDS = ['Booster', 'Bundle', 'Display', 'Pack', 'Case', 'Deck', 'Box', 'Draft Night', 'Secret Lair', 'Commander']

export function isSealedProduct(productName: string, groupName: string): boolean {
  // Some sets prefix product names with "Magic: The Gathering {groupName}" instead of just "{groupName}"
  const idx = productName.indexOf(groupName + ' - ')
  if (idx === -1) return false
  const suffix = productName.slice(idx + groupName.length + 3)
  return SEALED_KEYWORDS.some(k => suffix.includes(k))
}

async function tcgFetch<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TapNTrack/1.0)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? []
  } catch {
    return []
  }
}

export async function fetchGroups(): Promise<TcgGroup[]> {
  return tcgFetch<TcgGroup>(`${BASE}/groups`)
}

export async function fetchSealedProducts(groupId: number, groupName: string): Promise<TcgProduct[]> {
  const all = await tcgFetch<TcgProduct>(`${BASE}/${groupId}/products`)
  return all.filter(p => isSealedProduct(p.name, groupName))
}

export async function fetchGroupPrices(groupId: number): Promise<Map<number, number | null>> {
  const prices = await tcgFetch<TcgPrice>(`${BASE}/${groupId}/prices`)
  const map = new Map<number, number | null>()
  for (const p of prices) {
    if (p.subTypeName === 'Normal') {
      // marketPrice is the actual market average; midPrice can be skewed by outlier listings
      map.set(p.productId, p.marketPrice ?? null)
    }
  }
  return map
}
