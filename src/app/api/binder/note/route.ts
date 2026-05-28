import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const { displayName, note } = await req.json()
  if (!displayName?.trim()) return NextResponse.json({ error: 'Missing displayName' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('binder_cards')
    .update({ note: note?.trim() || null })
    .eq('user_id', user.id)
    .ilike('display_name', displayName.trim())
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Card not found in binder' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
