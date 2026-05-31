import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const { data, error } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, date, price')
    .eq('user_id', user.id)
    .order('date')

  if (error) return NextResponse.json({}, { status: 500 })

  const history: Record<number, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.tcg_product_id]) history[row.tcg_product_id] = []
    history[row.tcg_product_id].push({ date: row.date, price: row.price })
  }

  return NextResponse.json(history)
}
