import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { id, name } = await req.json()
  if (!id && !name?.trim()) return NextResponse.json({ error: 'Missing id or name' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = supabase
    .from('binder_cards')
    .delete()
    .eq('user_id', user.id)

  const { data, error } = await (id
    ? query.eq('id', id)
    : query.ilike('display_name', name.trim())
  ).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Card not found in binder' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
