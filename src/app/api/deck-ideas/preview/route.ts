import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { diffDecks, prepareDeck, suggestDeckName } from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { text, deckId, commanders } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Paste a decklist first' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prepared = await prepareDeck(text, Array.isArray(commanders) ? commanders : null)
  if (prepared.rows.length === 0) return NextResponse.json({ error: 'No cards found in that list' }, { status: 400 })

  const count = (board: string) => prepared.rows.filter(r => r.board === board).reduce((n, r) => n + r.qty, 0)

  let diff = null
  if (deckId) {
    const { data: existing } = await supabase
      .from('deck_idea_cards')
      .select('board, name, set_code, collector_number, foil_type, qty')
      .eq('deck_id', deckId)
    diff = diffDecks(existing ?? [], prepared.rows)
  }

  return NextResponse.json({
    counts: { commander: count('commander'), main: count('main'), sideboard: count('sideboard') },
    detectedCommanders: prepared.detectedCommanders,
    commanderCandidates: prepared.commanderCandidates,
    suggestedName: suggestDeckName(prepared.detectedCommanders),
    unparsed: prepared.unparsed,
    unresolved: prepared.unresolved,
    diff,
  })
}
