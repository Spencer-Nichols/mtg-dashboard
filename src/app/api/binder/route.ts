import { NextResponse } from 'next/server'
import { readBinder } from '@/lib/binder'

export async function GET() {
  try {
    return NextResponse.json({ entries: readBinder() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
