import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCached, cacheKey } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('binder_cards')
    .select('display_name, base_name, set_code, scryfall_id, foil, snapshot_price, date_added')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json([], { status: 500 })

  const cards = await Promise.all((data ?? []).map(async row => {
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    return {
      displayName: row.display_name,
      setCode: row.set_code ?? '',
      snapshotPrice: row.snapshot_price ?? 0,
      currentPrice: cached ? (row.foil ? (cached.foilPrice ?? cached.price) : cached.price) : null,
      imageUrl: cached?.imageUrl ?? null,
      dateAdded: row.date_added,
    }
  }))

  return NextResponse.json(cards)
}
