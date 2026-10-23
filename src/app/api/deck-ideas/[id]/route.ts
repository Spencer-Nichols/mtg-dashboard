import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeCardName } from '@/lib/deck-idea-parse'
import {
  colorIdentityOf, diffDecks, discoverCheapestForDeck, oracleIdMap, prepareDeck, recomputeTotals, toDbRow,
} from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

const HISTORY_DAYS = 30

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deck } = await supabase.from('deck_ideas').select('*').eq('id', id).maybeSingle()
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [{ data: cards }, { data: binder }, { data: history }, { data: wishlist }] = await Promise.all([
    supabase.from('deck_idea_cards').select('*').eq('deck_id', id).order('name'),
    supabase.from('binder_cards').select('base_name, display_name, scryfall_id, set_code, foil_type').eq('user_id', user.id),
    supabase.from('deck_idea_history').select('date, cheapest_total, exact_total').eq('deck_id', id).gte('date', since).order('date'),
    supabase.from('wishlist_singles').select('name').eq('user_id', user.id),
  ])

  const binderByName = new Map<string, NonNullable<typeof binder>>()
  for (const b of binder ?? []) {
    const name = normalizeCardName(b.base_name ?? '').toLowerCase()
    for (const key of new Set([name, name.split(' // ')[0]])) {
      binderByName.set(key, [...(binderByName.get(key) ?? []), b])
    }
  }
  const wishlistNames = (wishlist ?? []).map(w => w.name.toLowerCase())

  return NextResponse.json({
    deck: {
      id: deck.id,
      name: deck.name,
      colorIdentity: deck.color_identity,
      sourceUrl: deck.source_url,
      cheapestTotal: deck.cheapest_total,
      exactTotal: deck.exact_total,
      unpricedCount: deck.unpriced_count,
      pricedAt: deck.priced_at,
    },
    cards: (cards ?? []).map(c => {
      const name = c.name.toLowerCase()
      const copies = binderByName.get(name) ?? binderByName.get(name.split(' // ')[0]) ?? []
      const copy = copies.find(b => b.scryfall_id && b.scryfall_id === c.scryfall_id) ?? copies[0]
      const ownership = !copy ? 'missing' : copy.scryfall_id && copy.scryfall_id === c.scryfall_id ? 'owned' : 'owned_other'
      return {
        id: c.id,
        board: c.board,
        qty: c.qty,
        name: c.name,
        setCode: c.set_code,
        collectorNumber: c.collector_number,
        foilType: c.foil_type,
        typeLine: c.type_line,
        scryfallId: c.scryfall_id,
        cheapestScryfallId: c.cheapest_scryfall_id,
        imageUrl: c.image_url,
        exactPrice: c.exact_price,
        cheapestPrice: c.cheapest_price,
        cheapestSetCode: c.cheapest_set_code,
        cheapestCollectorNumber: c.cheapest_collector_number,
        cheapestFoilType: c.cheapest_foil_type,
        cheapestChecked: c.cheapest_checked_at != null,
        ownership,
        binderCopy: copy ? {
          displayName: copy.display_name,
          scryfallId: copy.scryfall_id,
          setCode: copy.set_code,
          foilType: copy.foil_type ?? 'none',
        } : null,
        onWishlist: wishlistNames.some(w => w === name || w.startsWith(`${name} (`)),
      }
    }),
    history: (history ?? []).map(h => ({ date: h.date, cheapestTotal: h.cheapest_total, exactTotal: h.exact_total })),
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { name, text, commanders, sourceUrl } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deck } = await supabase.from('deck_ideas').select('id').eq('id', id).maybeSingle()
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  const deckUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name?.trim()) deckUpdate.name = name.trim()
  if (sourceUrl !== undefined) deckUpdate.source_url = sourceUrl?.trim() || null

  if (!text?.trim()) {
    const { error } = await supabase.from('deck_ideas').update(deckUpdate).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id })
  }

  const prepared = await prepareDeck(text, Array.isArray(commanders) ? commanders : null)
  if (prepared.rows.length === 0) return NextResponse.json({ error: 'No cards found in that list' }, { status: 400 })

  const { data: oldCards } = await supabase.from('deck_idea_cards').select('*').eq('deck_id', id)
  const cheapestByName = new Map((oldCards ?? []).filter(c => c.cheapest_checked_at).map(c => [c.name.toLowerCase(), {
    cheapest_scryfall_id: c.cheapest_scryfall_id,
    cheapest_set_code: c.cheapest_set_code,
    cheapest_collector_number: c.cheapest_collector_number,
    cheapest_foil_type: c.cheapest_foil_type,
    cheapest_price: c.cheapest_price,
    cheapest_checked_at: c.cheapest_checked_at,
  }]))
  const diff = diffDecks(oldCards ?? [], prepared.rows)

  await supabase.from('deck_idea_cards').delete().eq('deck_id', id)
  const { error: insertError } = await supabase.from('deck_idea_cards').insert(
    prepared.rows.map(r => ({ ...toDbRow(r, id), ...cheapestByName.get(r.name.toLowerCase()) }))
  )
  if (insertError) {
    if (oldCards?.length) await supabase.from('deck_idea_cards').insert(oldCards)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  deckUpdate.color_identity = colorIdentityOf(prepared.rows)
  await supabase.from('deck_ideas').update(deckUpdate).eq('id', id)
  await recomputeTotals(supabase, [id], false)

  const oracleIds = oracleIdMap(prepared.rows)
  after(() => discoverCheapestForDeck(id, oracleIds))

  return NextResponse.json({ id, diff })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, count } = await supabase.from('deck_ideas').delete({ count: 'exact' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
