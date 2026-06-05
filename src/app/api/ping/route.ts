import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { page } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  await supabase.from('user_profiles').upsert(
    { user_id: user.id, last_seen: new Date().toISOString(), last_seen_page: page ?? null },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ ok: true })
}
