import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { leagueEnabled, loadLeagueState } from '@/lib/league/store'
import { sendProxyAccessEmail } from '@/lib/email'

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

  const [{ data: profiles }, { data: binderCounts }, { data: sealedCounts }, { data: wishlistCounts }, { data: flagProfiles }, { data: admins }, league] = await Promise.all([
    service.from('user_profiles').select('user_id, last_seen, last_seen_page').in('user_id', userIds),
    service.from('binder_cards').select('user_id').in('user_id', userIds),
    service.from('sealed_wishlist').select('user_id').in('user_id', userIds),
    service.from('wishlist_singles').select('user_id').in('user_id', userIds),
    service.from('user_profiles').select('user_id, unlimited_binder, proxy_access, last_league_seen').in('user_id', userIds),
    service.from('admins').select('user_id'),
    leagueEnabled() ? loadLeagueState().catch(err => { console.error('Admin users: league load failed', err); return null }) : Promise.resolve(null),
  ])

  const lastSeenByUser = new Map<string, { at: string; page: string | null }>()
  for (const row of profiles ?? []) {
    if (row.last_seen) lastSeenByUser.set(row.user_id, { at: row.last_seen, page: row.last_seen_page ?? null })
  }

  const unlimitedBinderByUser = new Map<string, boolean>()
  const proxyAccessByUser = new Map<string, boolean>()
  const lastLeagueVisitByUser = new Map<string, string>()
  for (const row of flagProfiles ?? []) {
    if (row.unlimited_binder) unlimitedBinderByUser.set(row.user_id, true)
    if (row.proxy_access) proxyAccessByUser.set(row.user_id, true)
    if (row.last_league_seen) lastLeagueVisitByUser.set(row.user_id, row.last_league_seen)
  }
  const adminIds = new Set((admins ?? []).map(a => a.user_id))
  const seatByUser = new Map((league?.members ?? []).filter(m => m.userId).map(m => [m.userId!, { name: m.name, role: m.role }]))

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
    proxyAccess: proxyAccessByUser.get(u.id) ?? false,
    isAdmin: adminIds.has(u.id),
    leagueSeat: seatByUser.get(u.id) ?? null,
    lastLeagueVisit: lastLeagueVisitByUser.get(u.id) ?? null,
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

  const { userId, unlimitedBinder, proxyAccess } = await req.json()
  const hasFlag = typeof unlimitedBinder === 'boolean' || typeof proxyAccess === 'boolean'
  if (!userId || !hasFlag) {
    return NextResponse.json({ error: 'Missing userId or a flag to change' }, { status: 400 })
  }

  const flags = {
    ...(typeof unlimitedBinder === 'boolean' && { unlimited_binder: unlimitedBinder }),
    ...(typeof proxyAccess === 'boolean' && { proxy_access: proxyAccess }),
  }
  const { data: before } = await service.from('user_profiles').select('proxy_access').eq('user_id', userId).maybeSingle()
  const { error } = await service
    .from('user_profiles')
    .upsert({ user_id: userId, ...flags }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const proxyGranted = proxyAccess === true && before?.proxy_access !== true
  if (proxyGranted) {
    try {
      const { data: target } = await service.auth.admin.getUserById(userId)
      const email = target.user?.email
      if (email) {
        await sendProxyAccessEmail(email)
        console.log('Proxy access email sent', { userId })
      } else {
        console.warn('Proxy access granted but user has no email', { userId })
      }
    } catch (err) {
      console.error('Proxy access email failed', { userId, err })
    }
  }
  return NextResponse.json({ ok: true, emailed: proxyGranted })
}
