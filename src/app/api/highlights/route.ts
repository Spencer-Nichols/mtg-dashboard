import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCached, getCronTimestamp, cacheKey, getSealedPrice } from '@/lib/cache'

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
  if (!user) return NextResponse.json({ topGainers: [], wishlistDrops: [], sealedDrops: [], lastUpdated: null }, { status: 401 })

  // --- Binder gainers ---
  const { data: binderRows } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id, foil, snapshot_price, purchase_price')
    .eq('user_id', user.id)

  const MIN_DOLLAR = 0.25
  const binderGainers: HighlightCard[] = []
  let totalDelta = 0
  for (const entry of binderRows ?? []) {
    const key = cacheKey(entry.base_name, entry.scryfall_id ?? entry.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const currentPrice = entry.foil ? (cached.foilPrice ?? cached.price) : cached.price
    const costBasis = entry.purchase_price ?? entry.snapshot_price ?? 0
    if (currentPrice == null || costBasis <= 0) continue
    const diff = currentPrice - costBasis
    const pct = (diff / costBasis) * 100
    totalDelta += diff
    if (pct > 0.05 && diff >= MIN_DOLLAR) {
      binderGainers.push({
        displayName: entry.display_name,
        snapshotPrice: costBasis,
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
  wishlistDrops.sort((a, b) => a.pct - b.pct).splice(5)

  // --- Sealed drops ---
  const { data: sealedRows } = await supabase
    .from('sealed_wishlist')
    .select('product_name, tcg_product_id, snapshot_price, image_url')
    .eq('user_id', user.id)

  const sealedDrops: HighlightCard[] = []
  for (const item of sealedRows ?? []) {
    const cached = await getSealedPrice(item.tcg_product_id)
    if (cached === 'miss' || cached === null) continue
    const snapshotPrice = item.snapshot_price ?? 0
    if (snapshotPrice <= 0) continue
    const pct = ((cached - snapshotPrice) / snapshotPrice) * 100
    if (pct <= -10) {
      sealedDrops.push({
        displayName: item.product_name,
        snapshotPrice,
        currentPrice: cached,
        pct,
        imageUrl: item.image_url ?? null,
      })
    }
  }
  sealedDrops.sort((a, b) => a.pct - b.pct).splice(5)


  const lastUpdated = await getCronTimestamp()

  return NextResponse.json({ topGainers, wishlistDrops, sealedDrops, lastUpdated, totalDelta: parseFloat(totalDelta.toFixed(2)) })
}
