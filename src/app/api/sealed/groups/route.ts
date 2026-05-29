import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchGroups } from '@/lib/tcgcsv'
import { getSealedGroups, setSealedGroups } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const cached = await getSealedGroups()
  if (cached) return NextResponse.json(cached)

  const groups = await fetchGroups()
  if (groups.length > 0) await setSealedGroups(groups)
  return NextResponse.json(groups)
}
