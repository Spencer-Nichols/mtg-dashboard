import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('notification_preferences')
    .select('email_sealed_alerts, email_singles_alerts')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    emailSealedAlerts: data?.email_sealed_alerts ?? false,
    emailSinglesAlerts: data?.email_singles_alerts ?? false,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailSealedAlerts, emailSinglesAlerts } = await req.json()
  if (typeof emailSealedAlerts !== 'boolean' && typeof emailSinglesAlerts !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const update: { user_id: string; email_sealed_alerts?: boolean; email_singles_alerts?: boolean } = { user_id: user.id }
  if (typeof emailSealedAlerts === 'boolean') update.email_sealed_alerts = emailSealedAlerts
  if (typeof emailSinglesAlerts === 'boolean') update.email_singles_alerts = emailSinglesAlerts

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(update, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ emailSealedAlerts, emailSinglesAlerts })
}
