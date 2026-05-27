import { NextRequest, NextResponse } from 'next/server'
import { readBinder, writeBinder } from '@/lib/binder'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing card name' }, { status: 400 })

  const entries = readBinder()
  const filtered = entries.filter(e => e.displayName.toLowerCase() !== name.trim().toLowerCase())

  if (filtered.length === entries.length) {
    return NextResponse.json({ error: 'Card not found in binder' }, { status: 404 })
  }

  writeBinder(filtered)
  return NextResponse.json({ ok: true })
}
