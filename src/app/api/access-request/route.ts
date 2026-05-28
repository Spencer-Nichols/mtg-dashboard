import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const service = createServiceClient()

  const { data: existing } = await service
    .from('access_requests')
    .select('id, status')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    if (existing.status === 'approved') return NextResponse.json({ error: 'This email already has access.' }, { status: 409 })
    return NextResponse.json({ error: 'A request for this email is already pending.' }, { status: 409 })
  }

  const { error } = await service
    .from('access_requests')
    .insert({ email: email.toLowerCase().trim(), status: 'pending' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
