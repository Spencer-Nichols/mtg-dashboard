import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { page } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const now = new Date().toISOString()
  const isLeaguePage = typeof page === 'string' && page.startsWith('league')
  const profile = { user_id: user.id, last_seen: now, last_seen_page: page ?? null, ...(isLeaguePage && { last_league_seen: now }) }
  await supabase.from('user_profiles').upsert(profile, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
