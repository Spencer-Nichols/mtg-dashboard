import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LEAGUE_EMAIL_TYPES } from '@/lib/league/email-types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('notification_preferences')
    .select('email_sealed_alerts, email_singles_alerts, league_email_prefs')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    emailSealedAlerts: data?.email_sealed_alerts ?? false,
    emailSinglesAlerts: data?.email_singles_alerts ?? false,
    leagueEmails: data?.league_email_prefs ?? {},
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailSealedAlerts, emailSinglesAlerts, leagueEmails } = await req.json()
  const leagueChanges = leagueEmails && typeof leagueEmails === 'object'
    ? Object.fromEntries(Object.entries(leagueEmails).filter(([k, v]) => k in LEAGUE_EMAIL_TYPES && typeof v === 'boolean'))
    : null
  if (typeof emailSealedAlerts !== 'boolean' && typeof emailSinglesAlerts !== 'boolean' && !leagueChanges) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const update: { user_id: string; email_sealed_alerts?: boolean; email_singles_alerts?: boolean; league_email_prefs?: Record<string, unknown> } = { user_id: user.id }
  if (typeof emailSealedAlerts === 'boolean') update.email_sealed_alerts = emailSealedAlerts
  if (typeof emailSinglesAlerts === 'boolean') update.email_singles_alerts = emailSinglesAlerts
  if (leagueChanges) {
    const { data: current } = await supabase
      .from('notification_preferences')
      .select('league_email_prefs')
      .eq('user_id', user.id)
      .maybeSingle()
    update.league_email_prefs = { ...(current?.league_email_prefs ?? {}), ...leagueChanges }
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(update, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ emailSealedAlerts, emailSinglesAlerts, leagueEmails: update.league_email_prefs })
}
