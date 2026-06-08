import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchByName, fetchById, searchCards, getPrice, frameSuffix } from '@/lib/scryfall'

export async function POST(req: NextRequest) {
  const { name, setCode, scryfallId, note } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const card = scryfallId
    ? await fetchById(scryfallId)
    : await fetchByName(name.trim(), setCode || undefined)

  if (!card) {
    const candidates = await searchCards(name.trim())
    if (candidates.length === 0) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (candidates.length > 1) {
      return NextResponse.json({
        candidates: candidates.map(c => ({
          name: c.name, setCode: c.set, setName: c.set_name,
          price: getPrice(c), type_line: c.type_line,
        }))
      })
    }
  }

  const resolved = card ?? null
  if (!resolved) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = getPrice(resolved)
  const cardName = resolved.name + frameSuffix(resolved)

  const { data: existing } = await supabase
    .from('wishlist_singles')
    .select('name')
    .ilike('name', cardName)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: `${cardName} is already on the wishlist` }, { status: 409 })

  const { error } = await supabase.from('wishlist_singles').insert({
    user_id: user.id,
    name: cardName,
    note: note?.trim() || null,
    set_code: resolved.set ?? null,
    scryfall_id: resolved.id ?? null,
    tcgplayer_id: resolved.tcgplayer_id ?? null,
    snapshot_price: price ?? null,
    snapshot_added_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const imageUrl = resolved.image_uris?.normal ?? resolved.card_faces?.[0]?.image_uris?.normal ?? null
  return NextResponse.json({ name: cardName, price, setCode: resolved.set, imageUrl })
}
