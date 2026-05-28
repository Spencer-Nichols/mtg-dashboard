import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCached, getCronTimestamp, cacheKey } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export interface HighlightCard {
  displayName: string
  snapshotPrice: number
  currentPrice: number
  pct: number
  imageUrl: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ topGainers: [], wishlistDrops: [], lastUpdated: null }, { status: 401 })

  // --- Binder gainers ---
  const { data: binderRows } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id, foil, snapshot_price')
    .eq('user_id', user.id)

  const binderGainers: HighlightCard[] = []
  for (const entry of binderRows ?? []) {
    const key = cacheKey(entry.base_name, entry.scryfall_id ?? entry.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const currentPrice = entry.foil ? (cached.foilPrice ?? cached.price) : cached.price
    const snapshotPrice = entry.snapshot_price ?? 0
    if (currentPrice == null || snapshotPrice <= 0) continue
    const pct = ((currentPrice - snapshotPrice) / snapshotPrice) * 100
    if (pct > 0) {
      binderGainers.push({
        displayName: entry.display_name,
        snapshotPrice,
        currentPrice,
        pct,
        imageUrl: cached.imageUrl ?? null,
      })
    }
  }
  binderGainers.sort((a, b) => b.pct - a.pct)
  const topGainers = binderGainers.slice(0, 5)

  // --- Wishlist drops ---
  const { data: wishlistRows } = await supabase
    .from('wishlist_singles')
    .select('name, set_code, scryfall_id, snapshot_price')
    .eq('user_id', user.id)

  const wishlistDrops: HighlightCard[] = []
  for (const single of wishlistRows ?? []) {
    const key = cacheKey(single.name, single.scryfall_id ?? single.set_code ?? '')
    const cached = await getCached(key)
    const snapshotPrice = single.snapshot_price ?? 0
    if (!cached || snapshotPrice <= 0) continue
    const currentPrice = cached.price
    if (currentPrice == null) continue
    const pct = ((currentPrice - snapshotPrice) / snapshotPrice) * 100
    if (pct < 0) {
      wishlistDrops.push({
        displayName: single.name,
        snapshotPrice,
        currentPrice,
        pct,
        imageUrl: cached.imageUrl ?? null,
      })
    }
  }
  wishlistDrops.sort((a, b) => a.pct - b.pct)

  const lastUpdated = await getCronTimestamp()

  return NextResponse.json({ topGainers, wishlistDrops, lastUpdated })
}
