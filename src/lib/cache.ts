import fs from 'fs'
import { CACHE_FILE } from './config'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  price: number | null
  foilPrice: number | null
  imageUrl: string | null
  timestamp: number
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
}

type Cache = Record<string, CacheEntry>

function load(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function save(cache: Cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

export function getCached(key: string): CacheEntry | null {
  const cache = load()
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL_MS) return null
  return entry
}

export function setCached(
  key: string,
  price: number | null,
  foilPrice: number | null,
  imageUrl: string | null,
  meta?: { setName?: string; setCode?: string; rarity?: string; typeLine?: string }
) {
  const cache = load()
  cache[key] = { price, foilPrice, imageUrl, timestamp: Date.now(), ...meta }
  save(cache)
}

export function cacheKey(name: string, setCode: string) {
  return `${name.toLowerCase()}|${setCode.toLowerCase()}`
}
