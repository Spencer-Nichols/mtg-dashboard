import { NextRequest, NextResponse } from 'next/server'
import { refreshAllPrices } from '@/lib/price-refresh'
import { refreshDeckIdeaPrices } from '@/lib/deck-ideas'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Deck ideas run first with a fixed budget so the slower binder/wishlist refresh can't starve them
const DECK_IDEA_BUDGET_MS = 90_000

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  let deckIdeas = null
  try {
    deckIdeas = await refreshDeckIdeaPrices(started + DECK_IDEA_BUDGET_MS)
  } catch (err) {
    console.error('Deck idea price refresh failed:', err)
  }
  const deckIdeasElapsed = ((Date.now() - started) / 1000).toFixed(1)

  const result = await refreshAllPrices()
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)

  return NextResponse.json({ ok: true, elapsed: `${elapsed}s`, deckIdeasElapsed: `${deckIdeasElapsed}s`, ...result, deckIdeas })
}
