import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCached, getCachedPriceByFoilType, getCronTimestamp, cacheKey } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export interface HighlightCard {
  displayName: string
  snapshotPrice: number
  currentPrice: number
  pct: number
  imageUrl: string | null
  isAtl?: boolean
  productId?: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ topGainers: [], wishlistDrops: [], sealedDrops: [], lastUpdated: null }, { status: 401 })

  // --- Binder gainers ---
  const { data: binderRows } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id, foil_type, snapshot_price')
    .eq('user_id', user.id)

  const today = new Date().toISOString().split('T')[0]
  const { data: historyRows } = await supabase
    .from('binder_card_history')
    .select('display_name, date, price')
    .eq('user_id', user.id)
    .lt('date', today)
    .order('date', { ascending: false })

  const dailyBaselineMap = new Map<string, number>()
  for (const row of historyRows ?? []) {
    if (!dailyBaselineMap.has(row.display_name)) dailyBaselineMap.set(row.display_name, row.price)
  }

  const MIN_DAILY_PCT = 2
  const binderGainers: HighlightCard[] = []
  let totalDelta = 0
  for (const entry of binderRows ?? []) {
    const key = cacheKey(entry.base_name, entry.scryfall_id ?? entry.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const currentPrice = getCachedPriceByFoilType(cached, entry.foil_type ?? 'none')
    const baseline = dailyBaselineMap.get(entry.display_name)
    if (currentPrice == null || baseline == null || baseline <= 0) continue
    const diff = currentPrice - baseline
    const pct = (diff / baseline) * 100
    totalDelta += diff
    if (pct >= MIN_DAILY_PCT) {
      binderGainers.push({
        displayName: entry.display_name,
        snapshotPrice: baseline,
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

  // --- Sealed drops + ATL ---
  const { data: sealedRows } = await supabase
    .from('sealed_wishlist')
    .select('product_name, tcg_product_id, snapshot_price, image_url')
    .eq('user_id', user.id)

  const atlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sealedProductIds = (sealedRows ?? []).map(r => r.tcg_product_id as number)
  const service = createServiceClient()
  const { data: sealedHistoryRows } = sealedProductIds.length > 0 ? await service
    .from('sealed_wishlist_history')
    .select('tcg_product_id, recorded_at, price')
    .in('tcg_product_id', sealedProductIds)
    .order('recorded_at', { ascending: false }) : { data: [] }

  const latestSealedPriceMap = new Map<number, number>()
  const sealedOlderPricesMap = new Map<number, number[]>()
  for (const row of sealedHistoryRows ?? []) {
    if (!latestSealedPriceMap.has(row.tcg_product_id)) {
      latestSealedPriceMap.set(row.tcg_product_id, row.price)
    }
    if (row.recorded_at < atlCutoff) {
      const arr = sealedOlderPricesMap.get(row.tcg_product_id) ?? []
      arr.push(row.price)
      sealedOlderPricesMap.set(row.tcg_product_id, arr)
    }
  }

  const sealedDrops: HighlightCard[] = []
  for (const item of sealedRows ?? []) {
    const currentPrice = latestSealedPriceMap.get(item.tcg_product_id)
    if (currentPrice == null) continue
    const snapshotPrice = item.snapshot_price ?? 0
    if (snapshotPrice <= 0) continue
    const pct = ((currentPrice - snapshotPrice) / snapshotPrice) * 100
    const olderPrices = sealedOlderPricesMap.get(item.tcg_product_id) ?? []
    const baseline = olderPrices.length > 0 ? Math.min(...olderPrices, snapshotPrice) : snapshotPrice
    const isAtl = baseline - currentPrice >= 2
    if (isAtl) {
      sealedDrops.push({
        displayName: item.product_name,
        snapshotPrice,
        currentPrice,
        pct,
        imageUrl: item.image_url ?? null,
        isAtl,
        productId: item.tcg_product_id,
      })
    }
  }
  sealedDrops.sort((a, b) => a.pct - b.pct).splice(5)


  const lastUpdated = await getCronTimestamp()

  return NextResponse.json({ topGainers, wishlistDrops, sealedDrops, lastUpdated, totalDelta: parseFloat(totalDelta.toFixed(2)) })
}
