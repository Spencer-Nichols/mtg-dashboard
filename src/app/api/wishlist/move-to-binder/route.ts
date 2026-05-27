import { NextRequest, NextResponse } from 'next/server'
import { fetchByName, getPrice, frameSuffix } from '@/lib/scryfall'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check not already in binder
  const { data: existing } = await supabase
    .from('binder_cards')
    .select('id')
    .ilike('base_name', name.trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `${name} is already in the binder` }, { status: 409 })
  }

  // Fetch card from Scryfall
  const card = await fetchByName(name.trim())
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(card)
  if (!price) return NextResponse.json({ error: 'No price data available' }, { status: 404 })

  // Add to binder
  const { error: insertError } = await supabase.from('binder_cards').insert({
    user_id: user.id,
    display_name: card.name + frameSuffix(card),
    base_name: card.name,
    set_code: card.set ?? null,
    scryfall_id: card.id ?? null,
    foil: false,
    count: 1,
    snapshot_price: price,
    note: null,
    date_added: new Date().toISOString().slice(0, 10),
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Remove from wishlist
  const { error: deleteError } = await supabase
    .from('wishlist_singles')
    .delete()
    .ilike('name', name.trim())

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, name: card.name + frameSuffix(card), price })
}
