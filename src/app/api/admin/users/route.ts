import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const service = createServiceClient()
  const { data: admin } = await service.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!admin) return NextResponse.json([], { status: 403 })

  const { data, error } = await service.auth.admin.listUsers()
  if (error) return NextResponse.json([], { status: 500 })

  const userIds = data.users.map(u => u.id)

  const [{ data: profiles }, { data: binderCounts }, { data: sealedCounts }, { data: wishlistCounts }, { data: flagProfiles }] = await Promise.all([
    service.from('user_profiles').select('user_id, last_seen, last_seen_page').in('user_id', userIds),
    service.from('binder_cards').select('user_id').in('user_id', userIds),
    service.from('sealed_wishlist').select('user_id').in('user_id', userIds),
    service.from('wishlist_singles').select('user_id').in('user_id', userIds),
    service.from('user_profiles').select('user_id, unlimited_binder').in('user_id', userIds),
  ])

  const lastSeenByUser = new Map<string, { at: string; page: string | null }>()
  for (const row of profiles ?? []) {
    if (row.last_seen) lastSeenByUser.set(row.user_id, { at: row.last_seen, page: row.last_seen_page ?? null })
  }

  const unlimitedBinderByUser = new Map<string, boolean>()
  for (const row of flagProfiles ?? []) {
    if (row.unlimited_binder) unlimitedBinderByUser.set(row.user_id, true)
  }

  const cardCountByUser = new Map<string, number>()
  for (const row of binderCounts ?? []) {
    cardCountByUser.set(row.user_id, (cardCountByUser.get(row.user_id) ?? 0) + 1)
  }

  const sealedCountByUser = new Map<string, number>()
  for (const row of sealedCounts ?? []) {
    sealedCountByUser.set(row.user_id, (sealedCountByUser.get(row.user_id) ?? 0) + 1)
  }

  const wishlistCountByUser = new Map<string, number>()
  for (const row of wishlistCounts ?? []) {
    wishlistCountByUser.set(row.user_id, (wishlistCountByUser.get(row.user_id) ?? 0) + 1)
  }

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    lastSeen: lastSeenByUser.get(u.id)?.at ?? null,
    lastSeenPage: lastSeenByUser.get(u.id)?.page ?? null,
    createdAt: u.created_at,
    cardCount: cardCountByUser.get(u.id) ?? 0,
    sealedCount: sealedCountByUser.get(u.id) ?? 0,
    wishlistCount: wishlistCountByUser.get(u.id) ?? 0,
    unlimitedBinder: unlimitedBinderByUser.get(u.id) ?? false,
  }))

  return NextResponse.json(users)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: admin } = await service.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, unlimitedBinder } = await req.json()
  if (!userId || typeof unlimitedBinder !== 'boolean') {
    return NextResponse.json({ error: 'Missing userId or unlimitedBinder' }, { status: 400 })
  }

  const { error } = await service
    .from('user_profiles')
    .upsert({ user_id: userId, unlimited_binder: unlimitedBinder }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
