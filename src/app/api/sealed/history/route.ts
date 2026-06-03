import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const service = createServiceClient()

  const { data: wishlistItems } = await supabase
    .from('sealed_wishlist')
    .select('tcg_product_id')
    .eq('user_id', user.id)

  const productIds = (wishlistItems ?? []).map(i => i.tcg_product_id as number)
  if (productIds.length === 0) return NextResponse.json({})

  const { data, error } = await service
    .from('sealed_wishlist_history')
    .select('tcg_product_id, recorded_at, price')
    .in('tcg_product_id', productIds)
    .order('recorded_at')

  if (error) return NextResponse.json({}, { status: 500 })

  const history: Record<number, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.tcg_product_id]) history[row.tcg_product_id] = []
    history[row.tcg_product_id].push({ date: row.recorded_at ?? new Date().toISOString(), price: row.price })
  }

  return NextResponse.json(history)
}
