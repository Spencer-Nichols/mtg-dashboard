import { NextRequest, NextResponse } from 'next/server'
import { ScryfallRateLimitError } from '@/lib/scryfall'
import { lookupPublicCard } from '@/lib/public-card'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }
const RATE_LIMITED_HEADERS = { 'Cache-Control': 'no-store, max-age=0', 'Retry-After': '5' }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing query param: q' }, { status: 400, headers: NO_STORE_HEADERS })

  const set = req.nextUrl.searchParams.get('set')?.trim() || undefined

  try {
    const body = await lookupPublicCard(q, set)
    if (!body) return NextResponse.json({ error: 'No cards found' }, { status: 404, headers: NO_STORE_HEADERS })
    return NextResponse.json(body, { headers: NO_STORE_HEADERS })
  } catch (err) {
    if (err instanceof ScryfallRateLimitError) {
      return NextResponse.json({ error: 'Rate limited, try again shortly' }, { status: 503, headers: RATE_LIMITED_HEADERS })
    }
    throw err
  }
}
