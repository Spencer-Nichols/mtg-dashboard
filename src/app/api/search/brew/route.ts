import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0' }
const OWNED_NAMES_PER_QUERY = 25
const SCRYFALL_DELAY_MS = 100

export interface BrewCard {
  id: string
  name: string
  typeLine: string
  manaCost: string | null
  imageUrl: string | null
  price: number | null
  rarity: string
  setName: string
  owned: boolean
  onWishlist: boolean
}

type ScryfallError = { status: number; details: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scryfallSearch(q: string, page: number, sort: string, dir: string): Promise<{ data: any[]; total: number; hasMore: boolean } | ScryfallError> {
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=${sort}&direction=${dir}&unique=cards&page=${page}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { status: res.status, details: (err as { details?: string }).details ?? 'No cards found for this query' }
  }
  const data = await res.json()
  return { data: data.data ?? [], total: data.total_cards ?? 0, hasMore: data.has_more ?? false }
}

// Scryfall can't filter by "cards I own", so we search in chunks of exact owned names: (query) (!"A" or !"B" ...)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchOwnedOnly(q: string, ownedNames: string[], sort: string, dir: string): Promise<any[] | ScryfallError> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = []
  for (let i = 0; i < ownedNames.length; i += OWNED_NAMES_PER_QUERY) {
    if (i > 0) await new Promise(r => setTimeout(r, SCRYFALL_DELAY_MS))
    const chunk = ownedNames.slice(i, i + OWNED_NAMES_PER_QUERY)
    const nameClause = chunk.map(n => `!"${n.replace(/"/g, '')}"`).join(' or ')
    const res = await scryfallSearch(`(${q}) (${nameClause})`, 1, sort, dir)
    if ('status' in res) {
      if (res.status === 404) continue
      return res
    }
    results.push(...res.data)
  }
  return results
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
  const sort = req.nextUrl.searchParams.get('sort') ?? 'edhrec'
  const dir = req.nextUrl.searchParams.get('dir') ?? 'desc'
  const ownedOnly = req.nextUrl.searchParams.get('owned') === 'true'
  if (!q) return NextResponse.json({ cards: [], total: 0, hasMore: false })

  try {
    const searchPromise = ownedOnly ? null : scryfallSearch(q, page, sort, dir)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [binderData, wishlistData] = await Promise.all([
      user ? supabase.from('binder_cards').select('base_name, scryfall_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
      user ? supabase.from('wishlist_singles').select('name, scryfall_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ])

    const binderEntries = binderData.data ?? []
    const binderIds = new Set(binderEntries.filter(e => e.scryfall_id).map(e => e.scryfall_id))
    const binderNames = new Set(binderEntries.map(e => e.base_name.toLowerCase()))

    const wishlistEntries = wishlistData.data ?? []
    const wishlistIds = new Set(wishlistEntries.filter(e => e.scryfall_id).map(e => e.scryfall_id))
    const wishlistNamesFallback = new Set(wishlistEntries.filter(e => !e.scryfall_id).map(e => e.name.toLowerCase()))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toBrewCard = (c: any): BrewCard => ({
      id: c.id,
      name: c.name,
      typeLine: c.type_line ?? '',
      manaCost: c.mana_cost ?? null,
      imageUrl: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null,
      price: c.prices?.usd ? parseFloat(c.prices.usd) : null,
      rarity: c.rarity ?? 'common',
      setName: c.set_name ?? '',
      owned: binderIds.has(c.id) || binderNames.has(c.name.toLowerCase()),
      onWishlist: wishlistIds.has(c.id) || wishlistNamesFallback.has(c.name.toLowerCase()),
    })

    if (ownedOnly) {
      const uniqueOwnedNames = [...new Set(binderEntries.map(e => e.base_name))]
      if (uniqueOwnedNames.length === 0) {
        return NextResponse.json({ error: 'Your binder is empty' }, { status: 404 })
      }
      const owned = await searchOwnedOnly(q, uniqueOwnedNames, sort, dir)
      if ('status' in owned) {
        return NextResponse.json({ error: owned.details }, { status: owned.status === 404 ? 404 : 400 })
      }
      if (owned.length === 0) {
        return NextResponse.json({ error: 'None of your cards match this search' }, { status: 404 })
      }
      const cards = owned.map(toBrewCard)
      return NextResponse.json({ cards, total: cards.length, hasMore: false })
    }

    const result = await searchPromise!
    if ('status' in result) {
      return NextResponse.json({ error: result.details }, { status: result.status === 404 ? 404 : 400 })
    }

    const cards = result.data.map(toBrewCard)
    return NextResponse.json({ cards, total: result.total || cards.length, hasMore: result.hasMore })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
