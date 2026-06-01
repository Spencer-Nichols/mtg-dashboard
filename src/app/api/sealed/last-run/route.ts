import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSealedCronTimestamp } from '@/lib/cache'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ lastRun: null }, { status: 401 })

  const lastRun = await getSealedCronTimestamp()
  return NextResponse.json({ lastRun })
}
