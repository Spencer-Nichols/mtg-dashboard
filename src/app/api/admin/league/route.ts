import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { leagueEnabled, leagueMembersForAdmin, loadLeagueState, startSeason, updateLeagueMember, wipeLeague } from '@/lib/league/store'
import { notifyLeague } from '@/lib/league/notify'
import { LeagueError } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  if (!leagueEnabled()) return { denied: NextResponse.json({ error: 'League is turned off' }, { status: 404 }) }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: admin } = await createServiceClient().from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!admin) return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { userId: user.id }
}

function fail(err: unknown) {
  if (err instanceof LeagueError) return NextResponse.json({ error: err.message }, { status: err.status })
  throw err
}

export async function GET() {
  const { denied } = await requireAdmin()
  if (denied) return denied
  return NextResponse.json(await leagueMembersForAdmin())
}

export async function POST() {
  const { denied, userId } = await requireAdmin()
  if (denied) return denied
  try {
    await startSeason(userId!)
    return NextResponse.json(await leagueMembersForAdmin())
  } catch (err) {
    return fail(err)
  }
}

export async function PATCH(req: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied
  const { memberId, email, role, name } = await req.json()
  try {
    const assigned = await updateLeagueMember(memberId, {
      email: email === undefined ? undefined : email,
      role: role === 'commissioner' || role === 'player' ? role : undefined,
      name: typeof name === 'string' ? name : undefined,
    })
    if (assigned) {
      const state = await loadLeagueState()
      if (state) after(() => notifyLeague(state, [{ kind: 'addedToLeague', memberId: assigned.id }]))
    }
    return NextResponse.json(await leagueMembersForAdmin())
  } catch (err) {
    return fail(err)
  }
}

export async function DELETE(req: NextRequest) {
  const { denied } = await requireAdmin()
  if (denied) return denied
  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'WIPE') return NextResponse.json({ error: 'Type WIPE to confirm' }, { status: 400 })
  try {
    await wipeLeague()
    return NextResponse.json(await leagueMembersForAdmin())
  } catch (err) {
    return fail(err)
  }
}
