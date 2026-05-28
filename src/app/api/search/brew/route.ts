import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HEADERS = { 'User-Agent': 'SpencerMTGDashboard/1.0' }

export interface BrewCard {
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
  if (!q) return NextResponse.json({ cards: [], total: 0, hasMore: false })

  try {
    const scryfallUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=edhrec&unique=cards&page=${page}`
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const [scryfallRes, binderData, wishlistData] = await Promise.all([
      fetch(scryfallUrl, { headers: HEADERS }),
      user ? supabase.from('binder_cards').select('base_name').eq('user_id', user.id) : Promise.resolve({ data: [] }),
      user ? supabase.from('wishlist_singles').select('name').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ])

    if (!scryfallRes.ok) {
      const err = await scryfallRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { details?: string }).details ?? 'No cards found for this query' },
        { status: scryfallRes.status === 404 ? 404 : 400 }
      )
    }

    const data = await scryfallRes.json()
    const binderNames = new Set((binderData.data ?? []).map(e => e.base_name.toLowerCase()))
    const wishlistNames = new Set((wishlistData.data ?? []).map(s => s.name.toLowerCase()))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards: BrewCard[] = (data.data ?? []).map((c: any) => ({
      name: c.name,
      typeLine: c.type_line ?? '',
      manaCost: c.mana_cost ?? null,
      imageUrl: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null,
      price: c.prices?.usd ? parseFloat(c.prices.usd) : null,
      rarity: c.rarity ?? 'common',
      setName: c.set_name ?? '',
      owned: binderNames.has(c.name.toLowerCase()),
      onWishlist: wishlistNames.has(c.name.toLowerCase()),
    }))

    return NextResponse.json({
      cards,
      total: data.total_cards ?? cards.length,
      hasMore: data.has_more ?? false,
    })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
