import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HISTORY_MIN_DELTA = 0.50

async function getHistory(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('binder_history')
    .select('recorded_at, total, card_count')
    .eq('user_id', userId)
    .order('recorded_at')

  if (error) return null
  return (data ?? []).map(h => ({
    date: h.recorded_at ?? new Date().toISOString(),
    total: h.total,
    card_count: h.card_count ?? null,
  }))
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const history = await getHistory(supabase, user.id)
  if (!history) return NextResponse.json([], { status: 500 })
  return NextResponse.json(history)
}

export async function POST(req: NextRequest) {
  const { total, card_count } = await req.json()
  if (typeof total !== 'number') return NextResponse.json({ error: 'Missing total' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const newTotal = parseFloat(total.toFixed(2))

  const { data: lastEntry } = await supabase
    .from('binder_history')
    .select('total')
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastTotal = lastEntry?.total ?? null
  if (lastTotal === null || Math.abs(newTotal - lastTotal) >= HISTORY_MIN_DELTA) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('binder_history').insert({
      user_id: user.id,
      date: today,
      total: newTotal,
      card_count: card_count ?? null,
    })
  }

  const history = await getHistory(supabase, user.id)
  if (!history) return NextResponse.json([], { status: 500 })
  return NextResponse.json(history)
}
