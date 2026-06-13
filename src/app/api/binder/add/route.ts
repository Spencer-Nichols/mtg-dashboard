import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchById, searchCards, getPrice, frameSuffix } from '@/lib/scryfall'

export async function POST(req: NextRequest) {
  const { name, setCode: forcedSet, scryfallId, note, foilType, purchasePrice, condition } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count } = await supabase
    .from('binder_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 500) {
    return NextResponse.json({ error: 'Binder limit reached (500 cards)' }, { status: 403 })
  }

  // Check for duplicate
  const dupQuery = scryfallId
    ? supabase.from('binder_cards').select('base_name').eq('user_id', user.id).eq('scryfall_id', scryfallId).limit(1)
    : supabase.from('binder_cards').select('base_name').eq('user_id', user.id).ilike('base_name', name.trim()).limit(1)
  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return NextResponse.json({ error: `${existing.base_name} is already in the binder` }, { status: 409 })

  const card = scryfallId
    ? await fetchById(scryfallId)
    : await fetchByName(name.trim(), forcedSet || undefined)

  if (!card) {
    const candidates = await searchCards(name.trim())
    if (candidates.length === 0) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (candidates.length > 1) {
      return NextResponse.json({
        candidates: candidates.map(c => ({
          name: c.name,
          setCode: c.set,
          setName: c.set_name,
          price: getPrice(c),
          type_line: c.type_line,
        }))
      })
    }
  }

  const resolved = card ?? null
  if (!resolved) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(resolved)
  if (!price) return NextResponse.json({ error: 'No price data available' }, { status: 404 })

  const newRow = {
    user_id: user.id,
    display_name: resolved.name + frameSuffix(resolved),
    base_name: resolved.name,
    set_code: resolved.set ?? null,
    scryfall_id: resolved.id ?? null,
    foil_type: foilType ?? 'none',
    count: 1,
    snapshot_price: price,
    added_price: price,
    purchase_price: typeof purchasePrice === 'number' ? purchasePrice : null,
    condition: condition ?? null,
    note: note?.trim() || null,
    date_added: new Date().toISOString().slice(0, 10),
  }

  const { error } = await supabase.from('binder_cards').insert(newRow)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const imageUrl = resolved.image_uris?.normal ?? resolved.card_faces?.[0]?.image_uris?.normal ?? null
  return NextResponse.json({ name: newRow.display_name, price, setCode: newRow.set_code, imageUrl })
}
