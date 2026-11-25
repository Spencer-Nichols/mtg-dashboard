import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Bump this when the onboarding modal content changes — resets all users
const ONBOARDING_VERSION = 8

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ onboarded: true, onboardingVersion: ONBOARDING_VERSION, whatsNewSeen: null }, { status: 401 })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('onboarding_version, whats_new_seen')
    .eq('user_id', user.id)
    .maybeSingle()

  // whats_new_seen comes from migration 0028; until it runs, skip per-page What's New instead of failing
  if (error) {
    console.warn('[profile] whats_new_seen unavailable, falling back', error.message)
    const { data: fallback } = await supabase
      .from('user_profiles')
      .select('onboarding_version')
      .eq('user_id', user.id)
      .maybeSingle()
    const onboardingVersion = fallback?.onboarding_version ?? 0
    return NextResponse.json({ onboarded: onboardingVersion >= ONBOARDING_VERSION, onboardingVersion, whatsNewSeen: null })
  }

  const onboardingVersion = data?.onboarding_version ?? 0
  return NextResponse.json({
    onboarded: onboardingVersion >= ONBOARDING_VERSION,
    onboardingVersion,
    whatsNewSeen: (data?.whats_new_seen ?? {}) as Record<string, number>,
  })
}

// Finishing the onboarding tour. The body lists every page's latest What's New version so they don't show again right after the tour.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const seenFromTour = (body?.whatsNewSeen ?? null) as Record<string, number> | null

  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, onboarded: true, onboarding_version: ONBOARDING_VERSION, ...(seenFromTour ? { whats_new_seen: seenFromTour } : {}) }, { onConflict: 'user_id' })

  if (error && seenFromTour) {
    console.warn('[profile] could not save whats_new_seen, saving onboarding only', error.message)
    await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, onboarded: true, onboarding_version: ONBOARDING_VERSION }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ ok: true })
}

// Dismissing one page's What's New: { page: '/search', version: 9 }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { page, version } = await req.json().catch(() => ({}))
  if (typeof page !== 'string' || typeof version !== 'number') {
    return NextResponse.json({ error: 'Missing page or version' }, { status: 400 })
  }

  const { data: current, error: readError } = await supabase
    .from('user_profiles')
    .select('whats_new_seen')
    .eq('user_id', user.id)
    .maybeSingle()
  if (readError) {
    console.warn('[profile] whats_new_seen unavailable on PATCH', readError.message)
    return NextResponse.json({ error: 'whats_new_seen unavailable' }, { status: 503 })
  }

  const seen = { ...((current?.whats_new_seen ?? {}) as Record<string, number>), [page]: version }
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, whats_new_seen: seen }, { onConflict: 'user_id' })
  if (error) {
    console.error('[profile] failed to save whats_new_seen', error.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
