import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCached, cacheKey } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Public, unauthenticated dump of all users' wishlist singles with cached current prices.
export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('wishlist_singles')
    .select('user_id, name, note, set_code, scryfall_id, snapshot_price, snapshot_added_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const singles = data ?? []

  const cards = await Promise.all(singles.map(async (s) => {
    const key = cacheKey(s.name, s.scryfall_id ?? s.set_code ?? '')
    const cached = await getCached(key)

    const scryfallPrice = cached?.price ?? null
    const manapoolPrice = cached?.manapoolPrice ?? null

    let currentPrice: number | null = null
    let priceSource: 'manapool' | 'scryfall' | null = null
    if (scryfallPrice != null && manapoolPrice != null) {
      if (manapoolPrice < scryfallPrice) {
        currentPrice = manapoolPrice
        priceSource = 'manapool'
      } else {
        currentPrice = scryfallPrice
        priceSource = 'scryfall'
      }
    } else if (manapoolPrice != null) {
      currentPrice = manapoolPrice
      priceSource = 'manapool'
    } else if (scryfallPrice != null) {
      currentPrice = scryfallPrice
      priceSource = 'scryfall'
    }

    const snapshotPrice = s.snapshot_price ?? null
    const pct = currentPrice != null && snapshotPrice != null && snapshotPrice > 0
      ? ((currentPrice - snapshotPrice) / snapshotPrice) * 100
      : null

    return {
      userId: s.user_id,
      name: s.name,
      note: s.note,
      setCode: s.set_code,
      scryfallId: s.scryfall_id,
      snapshotPrice,
      snapshotAddedAt: s.snapshot_added_at,
      currentPrice,
      priceSource,
      pct,
      imageUrl: cached?.imageUrl ?? null,
      setName: cached?.setName ?? null,
      rarity: cached?.rarity ?? null,
      typeLine: cached?.typeLine ?? null,
    }
  }))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: cards.length,
    cards,
  })
}
