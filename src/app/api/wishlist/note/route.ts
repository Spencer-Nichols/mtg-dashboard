import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WISHLIST_FILE = path.join(
  process.env.HOME || '',
  '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
)

export async function PATCH(req: NextRequest) {
  const { name, note } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const content = fs.readFileSync(WISHLIST_FILE, 'utf-8')
  const lines = content.split('\n')
  let found = false

  const updated = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed.match(/^\d+\s+/)) return line

    // Extract card name from line (strip quantity, [setCode:uuid], and existing // note)
    const cardName = trimmed
      .replace(/^\d+\s+/, '')
      .split('//')[0]
      .replace(/\s*\[[a-z0-9:_-]+\]$/i, '')
      .trim()

    if (cardName.toLowerCase() !== name.trim().toLowerCase()) return line

    found = true
    // Strip existing note and re-append
    const baseWithoutNote = line.replace(/\s*\/\/.*$/, '').trimEnd()
    return note?.trim() ? `${baseWithoutNote} // ${note.trim()}` : baseWithoutNote
  })

  if (!found) return NextResponse.json({ error: 'Card not found in wishlist' }, { status: 404 })

  fs.writeFileSync(WISHLIST_FILE, updated.join('\n'))
  return NextResponse.json({ ok: true })
}
