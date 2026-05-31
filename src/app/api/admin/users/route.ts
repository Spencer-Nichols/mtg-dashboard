import { NextResponse } from 'next/server'
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

  const [{ data: profiles }, { data: binderCounts }] = await Promise.all([
    service.from('user_profiles').select('user_id, last_seen').in('user_id', userIds),
    service.from('binder_cards').select('user_id').in('user_id', userIds),
  ])

  const lastSeenByUser = new Map<string, string>()
  for (const row of profiles ?? []) {
    if (row.last_seen) lastSeenByUser.set(row.user_id, row.last_seen)
  }

  const cardCountByUser = new Map<string, number>()
  for (const row of binderCounts ?? []) {
    cardCountByUser.set(row.user_id, (cardCountByUser.get(row.user_id) ?? 0) + 1)
  }

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    lastSeen: lastSeenByUser.get(u.id) ?? null,
    createdAt: u.created_at,
    cardCount: cardCountByUser.get(u.id) ?? 0,
  }))

  return NextResponse.json(users)
}
