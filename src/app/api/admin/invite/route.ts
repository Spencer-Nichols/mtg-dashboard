import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function assertAdmin(userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, email } = await req.json()
  if (!id || !email) return NextResponse.json({ error: 'Missing id or email' }, { status: 400 })

  const service = createServiceClient()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3001')

  let { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  })

  if (inviteError) {
    // User may exist in an unconfirmed state from a previously broken invite.
    // Delete and re-invite so they receive a fresh token.
    const { data: { users } } = await service.auth.admin.listUsers()
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (existing && !existing.email_confirmed_at) {
      await service.auth.admin.deleteUser(existing.id)
      const retry = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
      })
      inviteError = retry.error
    }
  }

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  await service.from('access_requests').update({ status: 'approved' }).eq('id', id)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await assertAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('access_requests').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
