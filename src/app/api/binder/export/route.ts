import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ error: 'Missing or invalid ?since=YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('binder_cards')
    .select('base_name, set_code, count, date_added')
    .gte('date_added', since)
    .order('date_added')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lines = (data ?? []).map(e => {
    const qty = (e.count ?? 1) > 1 ? `${e.count}x ` : '1x '
    const set = e.set_code ? ` (${e.set_code.toUpperCase()})` : ''
    return `${qty}${e.base_name}${set}`
  })

  return NextResponse.json({ lines, count: lines.length })
}
