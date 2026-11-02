import { NextRequest, NextResponse } from 'next/server'
import { leagueContext, resetLeague, VIEW_AS_COOKIE } from '@/lib/league/store'
import { LeagueError } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { canSwitchViewer, mockData } = await leagueContext()
    if (!canSwitchViewer) return NextResponse.json({ error: 'Switching players is turned off' }, { status: 403 })
    const { viewAs, reset, empty } = await req.json()
    if (reset && mockData) resetLeague(empty === true)
    const res = NextResponse.json({ ok: true })
    if (typeof viewAs === 'string') res.cookies.set(VIEW_AS_COOKIE, viewAs, { path: '/', sameSite: 'lax' })
    return res
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
