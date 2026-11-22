import { NextRequest, NextResponse } from 'next/server'
import { loadLeagueFromDb } from '@/lib/league/db'
import { sendInterestDigest } from '@/lib/league/notify'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = await loadLeagueFromDb()
  if (!state || state.season.status === 'ended') return NextResponse.json({ ok: true, sent: 0 })

  const covered = await sendInterestDigest(state)
  if (covered.length > 0) {
    const { error } = await createServiceClient()
      .from('league_interests')
      .update({ notified_at: new Date().toISOString() })
      .eq('season_id', state.season.id!)
      .in('id', covered)
    if (error) {
      console.error('Interest digest could not mark interests as sent:', error)
      return NextResponse.json({ error: 'Could not mark interests as sent' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, covered: covered.length })
}
