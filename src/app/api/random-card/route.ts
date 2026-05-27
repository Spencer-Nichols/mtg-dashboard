import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const res = await fetch('https://api.scryfall.com/cards/random', {
    headers: { 'User-Agent': 'SpencerMTGDashboard/1.0' },
  })

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch random card' }, { status: 502 })

  const card = await res.json()
  return NextResponse.json({ card, displayName: card.name })
}
