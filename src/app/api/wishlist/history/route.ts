import { NextRequest, NextResponse } from 'next/server'
import { loadWishlistHistory, saveWishlistHistory } from '@/lib/history'

export async function GET() {
  return NextResponse.json(loadWishlistHistory())
}

export async function POST(req: NextRequest) {
  const { prices } = await req.json()
  if (!prices || typeof prices !== 'object') return NextResponse.json({ error: 'Missing prices' }, { status: 400 })
  const history = saveWishlistHistory(prices)
  return NextResponse.json(history)
}
