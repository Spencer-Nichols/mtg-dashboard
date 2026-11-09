import { NextRequest, NextResponse } from 'next/server'
import { proxyUser } from '@/lib/proxy-access'
import { fetchById } from '@/lib/scryfall'
import { cardImageUrl, cardRowKey, exactPrice, recomputeTotals, type DeckScryfallCard } from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ cardId: string }> }

// Swaps one deck idea card to a different printing. If the deck already has a row for that
// printing (same board and finish), the quantities merge into it so the unique key holds.
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await proxyUser()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { supabase } = auth
  const { cardId } = await params
  const { scryfallId } = await req.json()
  if (typeof scryfallId !== 'string') return NextResponse.json({ error: 'Missing scryfallId' }, { status: 400 })

  const { data: row } = await supabase.from('deck_idea_cards').select('*').eq('id', cardId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const card = await fetchById(scryfallId) as DeckScryfallCard | null
  if (!card) return NextResponse.json({ error: 'Scryfall could not find that printing' }, { status: 502 })

  const changes = {
    name: card.name,
    set_code: card.set,
    collector_number: card.collector_number,
    scryfall_id: card.id,
    type_line: card.type_line,
    image_url: cardImageUrl(card),
    exact_price: exactPrice(card, row.foil_type),
  }
  const targetKey = cardRowKey({ ...row, ...changes })
  const { data: siblings } = await supabase.from('deck_idea_cards').select('id, qty, board, name, set_code, collector_number, foil_type').eq('deck_id', row.deck_id).neq('id', row.id)
  const existing = (siblings ?? []).find(s => cardRowKey(s) === targetKey)

  if (existing) {
    console.log('Proxy printing swap merged into existing row', { from: row.id, into: existing.id })
    await supabase.from('deck_idea_cards').update({ qty: existing.qty + row.qty }).eq('id', existing.id)
    await supabase.from('deck_idea_cards').delete().eq('id', row.id)
  } else {
    const { error } = await supabase.from('deck_idea_cards').update(changes).eq('id', row.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('deck_ideas').update({ updated_at: new Date().toISOString() }).eq('id', row.deck_id)
  await recomputeTotals(supabase, [row.deck_id], false)
  return NextResponse.json({ ok: true, mergedInto: existing?.id ?? null })
}
