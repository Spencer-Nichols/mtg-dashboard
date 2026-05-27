import { NextRequest, NextResponse } from 'next/server'
import { loadBinderHistory, saveBinderHistory } from '@/lib/history'

export async function GET() {
  return NextResponse.json(loadBinderHistory())
}

export async function POST(req: NextRequest) {
  const { total } = await req.json()
  if (typeof total !== 'number') return NextResponse.json({ error: 'Missing total' }, { status: 400 })
  const history = saveBinderHistory(total)
  return NextResponse.json(history)
}
