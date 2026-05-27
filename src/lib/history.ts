import fs from 'fs'
import path from 'path'

const SCRYFALL_DIR = path.join(process.env.HOME || '', 'Projects/scryfall')

export const BINDER_HISTORY_FILE = path.join(SCRYFALL_DIR, 'binder_history.json')
export const WISHLIST_HISTORY_FILE = path.join(SCRYFALL_DIR, 'wishlist_history.json')

export interface HistoryPoint {
  date: string
  total: number
}

export type CardHistory = Record<string, Array<{ date: string; price: number }>>

export function loadBinderHistory(): HistoryPoint[] {
  try { return JSON.parse(fs.readFileSync(BINDER_HISTORY_FILE, 'utf-8')) } catch { return [] }
}

export function saveBinderHistory(total: number): HistoryPoint[] {
  const today = new Date().toISOString().split('T')[0]
  const history = loadBinderHistory()
  const idx = history.findIndex(h => h.date === today)
  if (idx >= 0) history[idx].total = total
  else history.push({ date: today, total })
  const trimmed = history.slice(-90)
  fs.writeFileSync(BINDER_HISTORY_FILE, JSON.stringify(trimmed, null, 2))
  return trimmed
}

export function loadWishlistHistory(): CardHistory {
  try { return JSON.parse(fs.readFileSync(WISHLIST_HISTORY_FILE, 'utf-8')) } catch { return {} }
}

export function saveWishlistHistory(prices: Record<string, number>): CardHistory {
  const today = new Date().toISOString().split('T')[0]
  const history = loadWishlistHistory()
  for (const [name, price] of Object.entries(prices)) {
    if (!history[name]) history[name] = []
    const idx = history[name].findIndex(h => h.date === today)
    if (idx >= 0) history[name][idx].price = price
    else history[name].push({ date: today, price })
    history[name] = history[name].slice(-90)
  }
  fs.writeFileSync(WISHLIST_HISTORY_FILE, JSON.stringify(history, null, 2))
  return history
}
