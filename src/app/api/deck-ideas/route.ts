import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_DECK_IDEAS, artCropUrl, colorIdentityOf, discoverCheapestForDeck, oracleIdMap, prepareDeck, recomputeTotals, toDbRow,
} from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: decks, error } = await supabase
    .from('deck_ideas')
    .select('id, name, color_identity, cheapest_total, exact_total, unpriced_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(MAX_DECK_IDEAS)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!decks || decks.length === 0) return NextResponse.json({ decks: [], max: MAX_DECK_IDEAS })

  const deckIds = decks.map(d => d.id)
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString().split('T')[0]
  const [{ data: commanders }, { data: pending }, { data: history }] = await Promise.all([
    supabase.from('deck_idea_cards').select('deck_id, name, image_url').in('deck_id', deckIds).eq('board', 'commander'),
    supabase.from('deck_idea_cards').select('deck_id').in('deck_id', deckIds).is('cheapest_checked_at', null),
    supabase.from('deck_idea_history').select('deck_id, date, cheapest_total').in('deck_id', deckIds).gte('date', weekAgo).order('date', { ascending: true }),
  ])

  return NextResponse.json({
    max: MAX_DECK_IDEAS,
    decks: decks.map(d => {
      const deckCommanders = (commanders ?? []).filter(c => c.deck_id === d.id)
      const baseline = (history ?? []).find(h => h.deck_id === d.id)
      return {
        id: d.id,
        name: d.name,
        colorIdentity: d.color_identity,
        commanders: deckCommanders.map(c => c.name),
        artUrl: artCropUrl(deckCommanders[0]?.image_url ?? null),
        cheapestTotal: d.cheapest_total,
        exactTotal: d.exact_total,
        unpricedCount: d.unpriced_count,
        weekDelta: baseline?.cheapest_total != null && d.cheapest_total != null
          ? parseFloat((d.cheapest_total - baseline.cheapest_total).toFixed(2))
          : null,
        pendingCheapest: (pending ?? []).filter(p => p.deck_id === d.id).length,
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  const { name, text, commanders, sourceUrl } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing deck name' }, { status: 400 })
  if (!text?.trim()) return NextResponse.json({ error: 'Missing decklist' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { count } = await supabase
    .from('deck_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= MAX_DECK_IDEAS) {
    return NextResponse.json({ error: `Deck idea limit reached (${MAX_DECK_IDEAS} decks)` }, { status: 403 })
  }

  const prepared = await prepareDeck(text, Array.isArray(commanders) ? commanders : null)
  if (prepared.rows.length === 0) return NextResponse.json({ error: 'No cards found in that list' }, { status: 400 })

  const { data: deck, error } = await supabase
    .from('deck_ideas')
    .insert({
      user_id: user.id,
      name: name.trim(),
      color_identity: colorIdentityOf(prepared.rows),
      source_url: sourceUrl?.trim() || null,
    })
    .select('id')
    .single()
  if (error || !deck) return NextResponse.json({ error: error?.message ?? 'Failed to save deck' }, { status: 500 })

  const { error: cardsError } = await supabase.from('deck_idea_cards').insert(prepared.rows.map(r => toDbRow(r, deck.id)))
  if (cardsError) {
    await supabase.from('deck_ideas').delete().eq('id', deck.id)
    return NextResponse.json({ error: cardsError.message }, { status: 500 })
  }

  await recomputeTotals(supabase, [deck.id], false)
  const oracleIds = oracleIdMap(prepared.rows)
  after(() => discoverCheapestForDeck(deck.id, oracleIds))

  return NextResponse.json({ id: deck.id })
}
