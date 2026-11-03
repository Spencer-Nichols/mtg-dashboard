import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { leagueEnabled, loadLeagueState, mutateLeague } from '@/lib/league/store'
import { updateSettings } from '@/lib/league/actions'
import { LeagueError, type LeagueState } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await createServiceClient().from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return !!data
}

function settingsView(state: LeagueState | null) {
  if (!state) return { settings: null, scoringLocked: false, ended: false }
  return {
    settings: state.settings,
    scoringLocked: state.games.length > 0,
    ended: state.season?.status === 'ended',
  }
}

export async function GET() {
  if (!leagueEnabled()) return NextResponse.json({ error: 'League is turned off' }, { status: 404 })
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(settingsView(await loadLeagueState()))
}

export async function PATCH(req: NextRequest) {
  if (!leagueEnabled()) return NextResponse.json({ error: 'League is turned off' }, { status: 404 })
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { settings } = await req.json().catch(() => ({}))
  try {
    const updated = await mutateLeague(state => updateSettings(state, settings ?? {}))
    return NextResponse.json(settingsView(updated))
  } catch (err) {
    if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('League settings update failed:', err)
    throw err
  }
}
