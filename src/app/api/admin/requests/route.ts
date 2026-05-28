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

  const { data, error } = await service
    .from('access_requests')
    .select('id, email, created_at, status')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}
