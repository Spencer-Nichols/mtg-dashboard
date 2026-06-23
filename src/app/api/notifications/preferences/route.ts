import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('notification_preferences')
    .select('email_sealed_alerts')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ emailSealedAlerts: data?.email_sealed_alerts ?? false })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emailSealedAlerts } = await req.json()
  if (typeof emailSealedAlerts !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, email_sealed_alerts: emailSealedAlerts }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ emailSealedAlerts })
}
