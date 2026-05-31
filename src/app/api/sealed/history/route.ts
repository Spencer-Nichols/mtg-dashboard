import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const { data, error } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, recorded_at, price')
    .eq('user_id', user.id)
    .order('recorded_at')

  if (error) return NextResponse.json({}, { status: 500 })

  const history: Record<number, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.tcg_product_id]) history[row.tcg_product_id] = []
    history[row.tcg_product_id].push({ date: row.recorded_at ?? new Date().toISOString(), price: row.price })
  }

  return NextResponse.json(history)
}
