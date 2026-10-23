import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCollection, frameSuffix, getPrice } from '@/lib/scryfall'
import { normalizeCardName } from '@/lib/deck-idea-parse'

export const dynamic = 'force-dynamic'

const WISHLIST_LIMIT = 100

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { threshold, mode } = await req.json()
  const minPrice = Number(threshold)
  if (!Number.isFinite(minPrice) || minPrice < 0) return NextResponse.json({ error: 'Invalid price threshold' }, { status: 400 })
  const useCheapest = mode !== 'exact'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deck } = await supabase.from('deck_ideas').select('id, name').eq('id', id).maybeSingle()
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  const [{ data: cards }, { data: binder }, { data: wishlist }] = await Promise.all([
    supabase.from('deck_idea_cards').select('name, scryfall_id, exact_price, cheapest_scryfall_id, cheapest_price').eq('deck_id', id),
    supabase.from('binder_cards').select('base_name').eq('user_id', user.id),
    supabase.from('wishlist_singles').select('name').eq('user_id', user.id),
  ])

  const ownedNames = new Set((binder ?? []).map(b => normalizeCardName(b.base_name ?? '').toLowerCase()))
  const picks = new Map<string, { scryfallId: string; price: number }>()
  for (const card of cards ?? []) {
    const key = card.name.toLowerCase()
    if (ownedNames.has(key) || ownedNames.has(key.split(' // ')[0]) || picks.has(key)) continue
    const price = useCheapest ? card.cheapest_price ?? card.exact_price : card.exact_price
    const scryfallId = useCheapest ? card.cheapest_scryfall_id ?? card.scryfall_id : card.scryfall_id
    if (price == null || price < minPrice || !scryfallId) continue
    picks.set(key, { scryfallId, price })
  }

  const sorted = [...picks.values()].sort((a, b) => b.price - a.price)
  const scryfallCards = await fetchCollection(sorted.map(p => p.scryfallId))
  const existing = new Set((wishlist ?? []).map(w => w.name.toLowerCase()))
  let capacity = WISHLIST_LIMIT - (wishlist?.length ?? 0)

  const added: string[] = []
  const skipped: string[] = []
  let limitReached = false
  const rows = []
  for (const pick of sorted) {
    const card = scryfallCards.get(pick.scryfallId)
    if (!card) continue
    const cardName = card.name + frameSuffix(card)
    if (existing.has(cardName.toLowerCase())) {
      skipped.push(cardName)
      continue
    }
    if (capacity <= 0) {
      limitReached = true
      break
    }
    capacity--
    existing.add(cardName.toLowerCase())
    added.push(cardName)
    rows.push({
      user_id: user.id,
      name: cardName,
      note: `From deck idea: ${deck.name}`,
      set_code: card.set ?? null,
      scryfall_id: card.id,
      tcgplayer_id: card.tcgplayer_id ?? null,
      snapshot_price: getPrice(card) ?? pick.price,
      snapshot_added_at: new Date().toISOString(),
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('wishlist_singles').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ added, skipped, limitReached })
}
