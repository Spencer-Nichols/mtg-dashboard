const BASE = 'https://api.scryfall.com'
const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0' }

export interface ScryfallCard {
  id: string
  name: string
  mana_cost?: string
  type_line: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  set: string
  set_name: string
  collector_number: string
  rarity: string
  released_at: string
  full_art?: boolean
  border_color?: string
  frame_effects?: string[]
  image_uris?: { normal: string; art_crop: string; small: string }
  card_faces?: Array<{
    name: string
    mana_cost?: string
    oracle_text?: string
    image_uris?: { normal: string; art_crop: string; small: string }
  }>
  prices: {
    usd?: string | null
    usd_foil?: string | null
    usd_etched?: string | null
  }
}

export function frameSuffix(card: ScryfallCard): string {
  if (card.full_art) return ' (full art)'
  if (card.frame_effects?.includes('showcase')) return ' (showcase)'
  if (card.frame_effects?.includes('extendedart')) return ' (extended art)'
  if (card.border_color === 'borderless') return ' (borderless)'
  if (card.frame_effects?.includes('etched')) return ' (etched)'
  return ''
}

export async function fetchByName(name: string, setCode?: string): Promise<ScryfallCard | null> {
  try {
    const params: Record<string, string> = { fuzzy: name }
    if (setCode) params.set = setCode
    const url = `${BASE}/cards/named?` + new URLSearchParams(params)
    const res = await fetch(url, { headers: HEADERS })

    if (res.status === 404) {
      const body = await res.json().catch(() => ({}))
      // Only fall back to search for genuinely ambiguous names (no set code — set+name should be unambiguous)
      if (body?.type === 'ambiguous' && !setCode) {
        const results = await searchCards(name)
        return results[0] ?? null
      }
      return null
    }

    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchById(id: string): Promise<ScryfallCard | null> {
  try {
    const res = await fetch(`${BASE}/cards/${id}`, { headers: HEADERS })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function searchCards(name: string): Promise<ScryfallCard[]> {
  try {
    const url = `${BASE}/cards/search?` + new URLSearchParams({ q: name, order: 'edhrec' })
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    return data?.data?.slice(0, 8) ?? []
  } catch {
    return []
  }
}

export async function searchPrintings(name: string): Promise<ScryfallCard[]> {
  try {
    const url = `${BASE}/cards/search?` + new URLSearchParams({
      q: `!"${name}"`,
      unique: 'prints',
      order: 'released',
      dir: 'desc',
    })
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    return data?.data?.slice(0, 20) ?? []
  } catch {
    return []
  }
}

export function getPrice(card: ScryfallCard, foil = false): number | null {
  if (foil && card.prices.usd_foil) return parseFloat(card.prices.usd_foil)
  if (card.prices.usd) return parseFloat(card.prices.usd)
  return null
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
