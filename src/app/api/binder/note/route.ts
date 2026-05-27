import { NextRequest, NextResponse } from 'next/server'
import { readBinder, writeBinder } from '@/lib/binder'

export async function PATCH(req: NextRequest) {
  const { displayName, note } = await req.json()
  if (!displayName?.trim()) return NextResponse.json({ error: 'Missing displayName' }, { status: 400 })

  const entries = readBinder()
  let found = false

  const updated = entries.map(e => {
    if (e.displayName.toLowerCase() !== displayName.trim().toLowerCase()) return e
    found = true
    return { ...e, note: note?.trim() || null }
  })

  if (!found) return NextResponse.json({ error: 'Card not found in binder' }, { status: 404 })

  writeBinder(updated)
  return NextResponse.json({ ok: true })
}
