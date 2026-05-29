import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getHistory(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('binder_card_history')
    .select('display_name, date, price')
    .eq('user_id', userId)
    .order('date')

  if (error) return null

  const history: Record<string, Array<{ date: string; price: number }>> = {}
  for (const row of data ?? []) {
    if (!history[row.display_name]) history[row.display_name] = []
    history[row.display_name].push({ date: row.date, price: row.price })
  }
  return history
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const history = await getHistory(supabase, user.id)
  if (!history) return NextResponse.json({}, { status: 500 })
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
  const rows = Object.entries(prices as Record<string, number>).map(([display_name, price]) => ({
    user_id: user.id,
    display_name,
    date: today,
    price: parseFloat((price as number).toFixed(2)),
  }))

  const { error } = await supabase
    .from('binder_card_history')
    .upsert(rows, { onConflict: 'user_id,display_name,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const history = await getHistory(supabase, user.id)
  if (!history) return NextResponse.json({}, { status: 500 })
  return NextResponse.json(history)
}
