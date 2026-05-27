import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wishlist_singles')
    .delete()
    .ilike('name', name.trim())
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Card not found in wishlist' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
