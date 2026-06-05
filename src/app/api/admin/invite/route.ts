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
    console.log('[invite] initial inviteUserByEmail failed:', inviteError.message)

    const { data: listData, error: listError } = await service.auth.admin.listUsers()
    if (listError) return NextResponse.json({ error: `listUsers failed: ${listError.message}` }, { status: 500 })

    const existing = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    console.log('[invite] existing user found:', existing ? `id=${existing.id} last_sign_in_at=${existing.last_sign_in_at ?? 'null'}` : 'none')

    if (existing && !existing.last_sign_in_at) {
      const { error: deleteError } = await service.auth.admin.deleteUser(existing.id)
      console.log('[invite] deleteUser result:', deleteError ? deleteError.message : 'ok')
      if (deleteError) return NextResponse.json({ error: `deleteUser failed: ${deleteError.message}` }, { status: 500 })

      const retry = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
      })
      console.log('[invite] retry inviteUserByEmail result:', retry.error ? retry.error.message : 'ok')
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
