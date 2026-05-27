import { NextRequest, NextResponse } from 'next/server'
import { readBinder } from '@/lib/binder'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ error: 'Missing or invalid ?since=YYYY-MM-DD' }, { status: 400 })
  }

  const filtered = readBinder().filter(e => e.dateAdded && e.dateAdded >= since)

  const lines = filtered.map(e => {
    const qty = e.count > 1 ? `${e.count}x ` : '1x '
    const set = e.setCode ? ` (${e.setCode.toUpperCase()})` : ''
    return `${qty}${e.baseName}${set}`
  })

  return NextResponse.json({ lines, count: lines.length })
}
