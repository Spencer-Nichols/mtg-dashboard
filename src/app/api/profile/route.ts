import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ onboarded: true }, { status: 401 })

  const { data } = await supabase
    .from('user_profiles')
    .select('onboarded')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ onboarded: data?.onboarded ?? false })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, onboarded: true }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
