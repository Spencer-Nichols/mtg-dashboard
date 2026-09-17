import { NextRequest, NextResponse } from 'next/server'
import { fetchByName, fetchById, getPrice, frameSuffix } from '@/lib/scryfall'
import { createClient } from '@/lib/supabase/server'

const PRINTING_SUFFIX = /\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i

export async function POST(req: NextRequest) {
  const { name, purchasePrice } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up the exact printing the user wishlisted, so we don't fall back to Scryfall's default printing
  const { data: wishlistRow } = await supabase
    .from('wishlist_singles')
    .select('name, set_code, scryfall_id')
    .eq('user_id', user.id)
    .ilike('name', name.trim())
    .maybeSingle()

  if (!wishlistRow) return NextResponse.json({ error: 'Card not found in wishlist' }, { status: 404 })

  const card = wishlistRow.scryfall_id
    ? await fetchById(wishlistRow.scryfall_id)
    : await fetchByName(name.trim().replace(PRINTING_SUFFIX, '').replace(/\s*\/\/.*$/, ''), wishlistRow.set_code ?? undefined)

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  // Check not already in binder (by exact printing first, then by name)
  const dupQuery = card.id
    ? supabase.from('binder_cards').select('base_name').eq('user_id', user.id).eq('scryfall_id', card.id).limit(1)
    : supabase.from('binder_cards').select('base_name').eq('user_id', user.id).ilike('base_name', card.name).limit(1)
  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return NextResponse.json({ error: `${existing.base_name} is already in the binder` }, { status: 409 })

  const price = getPrice(card)
  if (!price) return NextResponse.json({ error: 'No price data available' }, { status: 404 })

  const parsedPurchasePrice = typeof purchasePrice === 'number' && !isNaN(purchasePrice) ? purchasePrice : null

  // Add to binder
  const { error: insertError } = await supabase.from('binder_cards').insert({
    user_id: user.id,
    display_name: card.name + frameSuffix(card),
    base_name: card.name,
    set_code: card.set ?? null,
    scryfall_id: card.id ?? null,
    foil_type: 'none',
    count: 1,
    snapshot_price: price,
    added_price: price,
    purchase_price: parsedPurchasePrice,
    note: null,
    date_added: new Date().toISOString().slice(0, 10),
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Remove from wishlist
  const { error: deleteError } = await supabase
    .from('wishlist_singles')
    .delete()
    .eq('user_id', user.id)
    .ilike('name', name.trim())

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, name: card.name + frameSuffix(card), price })
}
