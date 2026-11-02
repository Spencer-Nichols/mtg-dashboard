import { NextRequest, NextResponse } from 'next/server'
import { leagueContext } from '@/lib/league/store'
import { LeagueError } from '@/lib/league/types'
import { swapView, tradeView } from '@/lib/league/views'
import { priceLeagueCards } from '@/lib/league/prices'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { state, viewerId } = await leagueContext()
    const kind = req.nextUrl.searchParams.get('for')
    if (kind === 'trade') return NextResponse.json(tradeView(state, viewerId, await priceLeagueCards(state)))
    if (kind === 'swap') return NextResponse.json(swapView(state, viewerId, await priceLeagueCards(state)))
    return NextResponse.json({ error: 'Unknown option set' }, { status: 400 })
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
