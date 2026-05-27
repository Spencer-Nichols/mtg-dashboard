import { NextResponse } from 'next/server'
import { loadDecks } from '@/lib/decks'

export async function GET() {
  try {
    const decks = loadDecks()
    return NextResponse.json(decks.map(d => ({
      slug: d.slug,
      title: d.title,
      commander: d.commander,
      colors: d.colors,
      cardCount: d.cards.reduce((sum, c) => sum + c.count, 0),
    })))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
