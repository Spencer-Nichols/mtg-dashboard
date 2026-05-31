import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wishlist_card_history')
    .select('card_name, recorded_at, price')
    .order('recorded_at')

  if (error) return NextResponse.json({}, { status: 500 })

  // Reconstruct the { cardName: [{ date, price }] } shape the frontend expects
  const history: Record<string, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.card_name]) history[row.card_name] = []
    history[row.card_name].push({ date: row.recorded_at ?? new Date().toISOString(), price: row.price })
  }

  return NextResponse.json(history)
}

export async function POST(req: NextRequest) {
  const { prices } = await req.json()
  if (!prices || typeof prices !== 'object') {
    return NextResponse.json({ error: 'Missing prices' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const rows = Object.entries(prices as Record<string, number>).map(([card_name, price]) => ({
    user_id: user.id,
    card_name,
    date: today,
    price: parseFloat((price as number).toFixed(2)),
  }))

  const { error } = await supabase
    .from('wishlist_card_history')
    .upsert(rows, { onConflict: 'user_id,card_name,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return in the same shape as GET
  const { data } = await supabase
    .from('wishlist_card_history')
    .select('card_name, recorded_at, price')
    .order('recorded_at')

  const history: Record<string, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.card_name]) history[row.card_name] = []
    history[row.card_name].push({ date: row.recorded_at ?? new Date().toISOString(), price: row.price })
  }

  return NextResponse.json(history)
}
