import { NextRequest, NextResponse } from 'next/server'
import { loadDeck } from '@/lib/decks'
import { getCollectionStatus } from '@/lib/collection'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const deck = loadDeck(slug)
    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

    const cards = deck.cards.map(c => ({
      ...c,
      status: getCollectionStatus(c.name),
    }))

    const commanderStatus = deck.commander ? getCollectionStatus(deck.commander) : null

    return NextResponse.json({ ...deck, cards, commanderStatus })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
