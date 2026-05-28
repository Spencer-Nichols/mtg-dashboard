import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchById, fetchByName, getPrice, frameSuffix } from '@/lib/scryfall'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { displayName, scryfallId, setCode, foil, purchasePrice, condition } = await req.json()
  if (!displayName) return NextResponse.json({ error: 'Missing displayName' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  // If a new printing was selected, fetch it and reset snapshot price
  if (scryfallId !== undefined || setCode !== undefined) {
    const card = scryfallId
      ? await fetchById(scryfallId)
      : await fetchByName(displayName, setCode)
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    const isFoil = foil ?? false
    const price = getPrice(card, isFoil) ?? getPrice(card, false) ?? 0

    updates.scryfall_id = card.id
    updates.set_code = card.set
    updates.display_name = card.name + frameSuffix(card)
    updates.base_name = card.name.replace(/\s*\/\/.*$/, '').trim()
    updates.snapshot_price = price
    if (foil !== undefined) updates.foil = isFoil
  } else if (foil !== undefined) {
    updates.foil = foil
  }

  if (purchasePrice !== undefined) updates.purchase_price = purchasePrice
  if (condition !== undefined) updates.condition = condition

  const { error } = await supabase
    .from('binder_cards')
    .update(updates)
    .eq('user_id', user.id)
    .eq('display_name', displayName)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updates })
}
