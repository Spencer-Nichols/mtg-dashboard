import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Bump this when the onboarding modal content changes — resets all users
const ONBOARDING_VERSION = 3

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ onboarded: true }, { status: 401 })

  const { data } = await supabase
    .from('user_profiles')
    .select('onboarding_version')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ onboarded: (data?.onboarding_version ?? 0) >= ONBOARDING_VERSION })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, onboarded: true, onboarding_version: ONBOARDING_VERSION }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
