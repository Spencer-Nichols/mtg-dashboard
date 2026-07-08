import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabase
    .from('binder_events')
    .select('id, date, label')
    .eq('user_id', user.id)
    .order('date')

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { date, label } = await req.json()
  if (!date || !label?.trim()) return NextResponse.json({ error: 'Missing date or label' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('binder_events')
    .insert({ user_id: user.id, date, label: label.trim() })
    .select('id, date, label')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('binder_events').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
