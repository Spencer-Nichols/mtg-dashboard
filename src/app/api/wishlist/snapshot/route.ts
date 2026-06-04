import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const { name, snapshotPrice } = await req.json()
  if (!name?.trim() || typeof snapshotPrice !== 'number') return NextResponse.json({ error: 'Missing name or snapshotPrice' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('wishlist_singles')
    .update({ snapshot_price: snapshotPrice, snapshot_added_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .ilike('name', name.trim())
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Card not found in wishlist' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
