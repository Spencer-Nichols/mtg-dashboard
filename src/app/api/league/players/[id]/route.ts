import { NextRequest, NextResponse } from 'next/server'
import { LeagueError } from '@/lib/league/types'
import { playerView } from '@/lib/league/views'
import { priceLeagueCards } from '@/lib/league/prices'
import { binderImportEnabled, leagueContext } from '@/lib/league/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { state, viewerId } = await leagueContext()
    const view = playerView(state, viewerId, id, await priceLeagueCards(state))
    if (!view) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    return NextResponse.json({ ...view, binderImportEnabled: binderImportEnabled() })
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
