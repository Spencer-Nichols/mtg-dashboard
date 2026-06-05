import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json([], { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const service = createServiceClient()
  const { data: admin } = await service.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!admin) return NextResponse.json([], { status: 403 })

  const { data, error } = await service
    .from('sealed_wishlist')
    .select('id, product_name, set_name, snapshot_price')
    .eq('user_id', userId)
    .order('created_at')

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}
