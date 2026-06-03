import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const TTL_SECONDS = 24 * 60 * 60

export interface CacheEntry {
  price: number | null
  foilPrice: number | null
  etchedPrice: number | null
  imageUrl: string | null
  backImageUrl?: string | null
  timestamp: number
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
  manapoolPrice?: number | null
  manapoolUrl?: string | null
}

export async function getCached(key: string): Promise<CacheEntry | null> {
  return redis.get<CacheEntry>(key)
}

export async function setCached(
  key: string,
  price: number | null,
  foilPrice: number | null,
  imageUrl: string | null,
  meta?: { setName?: string; setCode?: string; rarity?: string; typeLine?: string; backImageUrl?: string | null; etchedPrice?: number | null }
) {
  const { etchedPrice = null, ...rest } = meta ?? {}
  const entry: CacheEntry = { price, foilPrice, etchedPrice, imageUrl, timestamp: Date.now(), ...rest }
  await redis.set(key, entry, { ex: TTL_SECONDS })
}

export async function setManapoolPrice(key: string, price: number | null, url: string | null) {
  const existing = await redis.get<CacheEntry>(key)
  if (!existing) return
  await redis.set(key, { ...existing, manapoolPrice: price, manapoolUrl: url }, { ex: TTL_SECONDS })
}

export function getCachedPriceByFoilType(cached: CacheEntry, foilType: string): number | null {
  if (foilType === 'etched') return cached.etchedPrice ?? cached.foilPrice ?? cached.price
  if (foilType === 'foil') return cached.foilPrice ?? cached.price
  return cached.price
}

export function cacheKey(name: string, setCode: string) {
  return `price:${name.toLowerCase()}|${setCode.toLowerCase()}`
}

const SEALED_GROUPS_TTL = 24 * 60 * 60

export async function getSealedGroups(): Promise<unknown[] | null> {
  return redis.get<unknown[]>('tcgcsv:groups')
}

export async function setSealedGroups(groups: unknown[]) {
  await redis.set('tcgcsv:groups', groups, { ex: SEALED_GROUPS_TTL })
}

const CRON_TIMESTAMP_KEY = 'cron:last_run'

export async function setCronTimestamp() {
  await redis.set(CRON_TIMESTAMP_KEY, Date.now())
}

export async function getCronTimestamp(): Promise<number | null> {
  return redis.get<number>(CRON_TIMESTAMP_KEY)
}

const SEALED_CRON_TIMESTAMP_KEY = 'cron:sealed_last_run'

export async function setSealedCronTimestamp() {
  await redis.set(SEALED_CRON_TIMESTAMP_KEY, Date.now())
}

export async function getSealedCronTimestamp(): Promise<number | null> {
  return redis.get<number>(SEALED_CRON_TIMESTAMP_KEY)
}
