import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('binder_history')
    .select('date, total')
    .order('date')

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json((data ?? []).map(h => ({ date: h.date, total: h.total })))
}

export async function POST(req: NextRequest) {
  const { total } = await req.json()
  if (typeof total !== 'number') return NextResponse.json({ error: 'Missing total' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('binder_history')
    .upsert(
      { user_id: user.id, date: today, total: parseFloat(total.toFixed(2)) },
      { onConflict: 'user_id,date' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = await supabase
    .from('binder_history')
    .select('date, total')
    .order('date')

  return NextResponse.json((data ?? []).map(h => ({ date: h.date, total: h.total })))
}
