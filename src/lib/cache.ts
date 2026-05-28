import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const TTL_SECONDS = 24 * 60 * 60

export interface CacheEntry {
  price: number | null
  foilPrice: number | null
  imageUrl: string | null
  backImageUrl?: string | null
  timestamp: number
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
}

export async function getCached(key: string): Promise<CacheEntry | null> {
  return redis.get<CacheEntry>(key)
}

export async function setCached(
  key: string,
  price: number | null,
  foilPrice: number | null,
  imageUrl: string | null,
  meta?: { setName?: string; setCode?: string; rarity?: string; typeLine?: string; backImageUrl?: string | null }
) {
  const entry: CacheEntry = { price, foilPrice, imageUrl, timestamp: Date.now(), ...meta }
  await redis.set(key, entry, { ex: TTL_SECONDS })
}

export function cacheKey(name: string, setCode: string) {
  return `price:${name.toLowerCase()}|${setCode.toLowerCase()}`
}

const CRON_TIMESTAMP_KEY = 'cron:last_run'

export async function setCronTimestamp() {
  await redis.set(CRON_TIMESTAMP_KEY, Date.now())
}

export async function getCronTimestamp(): Promise<number | null> {
  return redis.get<number>(CRON_TIMESTAMP_KEY)
}
