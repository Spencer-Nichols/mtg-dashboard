import { frameSuffix, type ScryfallCard } from '@/lib/scryfall'

// Related sets players may log alongside the main set. They reuse its collector numbers,
// so a number for one of them carries the set code as a suffix ("12sds", "42trc").
const EXTRA_SETS: Record<string, string[]> = { trk: ['sds', 'trc'] }

export function packSets(packSet: string) {
  return [packSet, ...(EXTRA_SETS[packSet] ?? [])]
}

export function packSetQuery(packSet: string) {
  const sets = packSets(packSet)
  return sets.length === 1 ? `set:${sets[0]}` : `(${sets.map(s => `set:${s}`).join(' or ')})`
}

// "042" is trk 42, "12sds" is sds 12, "42trc" is trc 42, "#1701D" is trk 1701D. Returns null for anything else.
export function parsePackNumber(raw: string, packSet: string): { set: string; number: string } | null {
  const text = raw.trim().replace(/^#/, '')
  const bonus = (EXTRA_SETS[packSet] ?? []).find(code => text.toLowerCase().endsWith(code))
  const set = bonus ?? packSet
  const number = (bonus ? text.slice(0, -bonus.length) : text).replace(/^0+(?=\d)/, '')
  return /^\d+[a-z]?$/i.test(number) ? { set, number } : null
}

export function printingLabel(card: ScryfallCard, packSet: string) {
  if (card.set !== packSet) return card.set_name
  return frameSuffix(card).replace(/[()]/g, '').trim() || 'Regular'
}
