import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MOXFIELD_HEADERS = ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Last Modified', 'Collector Number', 'Alter', 'Proxy', 'Purchase Price']

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(f => {
    const s = f == null ? '' : String(f)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ error: 'Missing or invalid ?since=YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('binder_cards')
    .select('base_name, set_code, count, foil, condition, purchase_price, date_added')
    .eq('user_id', user.id)
    .gte('date_added', since)
    .order('date_added')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No cards added since that date' }, { status: 404 })
  }

  const lines = [
    csvRow(MOXFIELD_HEADERS),
    ...(data.map(e => csvRow([
      e.count ?? 1,
      0,
      e.base_name,
      (e.set_code ?? '').toUpperCase(),
      e.condition ?? 'NM',
      'en',
      e.foil ? 'foil' : '',
      '',
      e.date_added ?? '',
      '',
      'false',
      'false',
      e.purchase_price != null ? e.purchase_price.toFixed(2) : '',
    ])))
  ]

  const csv = lines.join('\n')
  const filename = `moxfield_export_${since}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
