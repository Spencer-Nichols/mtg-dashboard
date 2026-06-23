import { createServiceClient } from '@/lib/supabase/service'
import { setSealedCronTimestamp } from '@/lib/cache'
import { fetchTcgPlayerPrice } from '@/lib/tcgplayer'
import { sendSealedAlertEmail, type SealedAlertProduct } from '@/lib/email'

const COOLDOWN_MS = 8 * 60 * 60 * 1000
const NORMAL_DROP_PCT = 5
const URGENCY_DROP_PCT = 15

const MANAPOOL_URL = (ids: number[]) =>
  `https://manapool.com/api/v1/products/sealed?${ids.map(id => `tcgplayer_ids=${id}`).join('&')}`

const PRICE_MIN_DELTA = 0.25

interface ManaPoolSealedEntry { price: number; url: string | null }

async function fetchManaPoolPrices(productIds: number[]): Promise<Map<number, ManaPoolSealedEntry>> {
  const map = new Map<number, ManaPoolSealedEntry>()
  if (productIds.length === 0) return map

  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100)
    try {
      const res = await fetch(MANAPOOL_URL(batch))
      if (!res.ok) {
        console.error(`Manapool sealed API error: ${res.status}`, await res.text().catch(() => ''))
        continue
      }
      const data = await res.json()
      for (const item of data?.data ?? []) {
        if (item.tcgplayer_product_id != null && item.low_price != null) {
          map.set(item.tcgplayer_product_id, {
            price: parseFloat((item.low_price / 100).toFixed(2)),
            url: item.url ?? null,
          })
        }
      }
    } catch {
      // non-fatal — TCGPlayer will cover missing products
    }
  }
  return map
}

export interface SealedRefreshResult {
  products: number
  pricesFetched: number
  historyRows: number
  atlRows: number
}

export async function refreshSealedPrices(): Promise<SealedRefreshResult> {
  const supabase = createServiceClient()

  const { data: sealedRows, error } = await supabase
    .from('sealed_wishlist')
    .select('user_id, tcg_product_id, snapshot_price, target_price, product_name, set_name, image_url')

  if (error) throw new Error(`Failed to fetch sealed wishlist: ${error.message}`)
  if (!sealedRows || sealedRows.length === 0) {
    return { products: 0, pricesFetched: 0, historyRows: 0, atlRows: 0 }
  }

  const uniqueProductIds = [...new Set(sealedRows.map(r => Number(r.tcg_product_id)))]
  const now = new Date().toISOString()

  // Fetch Manapool prices (one batch request) and TCGPlayer prices (sequential) in parallel
  const [manapoolPrices, tcgPrices] = await Promise.all([
    fetchManaPoolPrices(uniqueProductIds),
    (async () => {
      const map = new Map<number, number | null>()
      for (const productId of uniqueProductIds) {
        map.set(productId, await fetchTcgPlayerPrice(productId))
        await new Promise(r => setTimeout(r, 300))
      }
      return map
    })(),
  ])

  // For each product, take the lower of the two prices and track the source
  const priceMap = new Map<number, number | null>()
  const sourceMap = new Map<number, 'manapool' | 'tcgplayer'>()
  const manapoolUrlMap = new Map<number, string>()
  for (const productId of uniqueProductIds) {
    const mpEntry = manapoolPrices.get(productId) ?? null
    const mp = mpEntry?.price ?? null
    if (mpEntry?.url) manapoolUrlMap.set(productId, mpEntry.url)
    const tcg = tcgPrices.get(productId) ?? null
    if (mp == null && tcg == null) {
      priceMap.set(productId, null)
    } else if (mp == null) {
      priceMap.set(productId, tcg)
      sourceMap.set(productId, 'tcgplayer')
    } else if (tcg == null) {
      priceMap.set(productId, mp)
      sourceMap.set(productId, 'manapool')
    } else {
      const lower = Math.min(mp, tcg)
      priceMap.set(productId, lower)
      sourceMap.set(productId, lower === mp ? 'manapool' : 'tcgplayer')
    }
  }

  // Persist Manapool URLs to sealed_wishlist so the stream can serve them
  if (manapoolUrlMap.size > 0) {
    for (const [productId, url] of manapoolUrlMap) {
      await supabase
        .from('sealed_wishlist')
        .update({ manapool_url: url })
        .eq('tcg_product_id', productId)
    }
  }

  const pricesFetched = [...priceMap.values()].filter(p => p != null).length

  const { data: lastPrices } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, price')
    .in('tcg_product_id', uniqueProductIds)
    .order('recorded_at', { ascending: false })

  const lastPriceMap = new Map<number, number>()
  for (const row of lastPrices ?? []) {
    if (!lastPriceMap.has(row.tcg_product_id)) lastPriceMap.set(row.tcg_product_id, row.price)
  }

  const historyInserts: { tcg_product_id: number; recorded_at: string; price: number; price_source: string }[] = []
  for (const productId of uniqueProductIds) {
    const price = priceMap.get(productId)
    if (price == null) continue
    const lastPrice = lastPriceMap.get(productId)
    if (lastPrice != null && Math.abs(price - lastPrice) < PRICE_MIN_DELTA) continue
    historyInserts.push({
      tcg_product_id: productId,
      recorded_at: now,
      price,
      price_source: sourceMap.get(productId) ?? 'tcgplayer',
    })
  }

  if (historyInserts.length > 0) {
    const { error: insertError } = await supabase.from('sealed_wishlist_history').insert(historyInserts)
    if (insertError) throw new Error(`Failed to write history: ${insertError.message}`)
  }

  // ATL notifications
  const atlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: allHistory } = await supabase
    .from('sealed_wishlist_history')
    .select('tcg_product_id, price, recorded_at')
    .in('tcg_product_id', uniqueProductIds)
    .lt('recorded_at', atlCutoff)

  const { data: lastNotifications } = await supabase
    .from('sealed_atl_notifications')
    .select('user_id, tcg_product_id, notified_price, notified_at')
    .in('tcg_product_id', uniqueProductIds)
    .order('notified_at', { ascending: false })

  const lastNotifMap = new Map<string, { price: number; notifiedAt: string }>()
  for (const row of lastNotifications ?? []) {
    const key = `${row.user_id}:${row.tcg_product_id}`
    if (!lastNotifMap.has(key)) lastNotifMap.set(key, { price: row.notified_price, notifiedAt: row.notified_at })
  }

  const olderPricesMap = new Map<number, number[]>()
  for (const row of allHistory ?? []) {
    const arr = olderPricesMap.get(row.tcg_product_id) ?? []
    arr.push(row.price)
    olderPricesMap.set(row.tcg_product_id, arr)
  }

  const atlInserts: { user_id: string; tcg_product_id: number; notified_price: number; notified_at: string; is_atl: boolean }[] = []
  for (const row of sealedRows) {
    const price = priceMap.get(row.tcg_product_id)
    if (price == null) continue
    const key = `${row.user_id}:${row.tcg_product_id}`
    const olderPrices = olderPricesMap.get(row.tcg_product_id) ?? []
    const snapshotPrice = row.snapshot_price ?? 0
    const targetPrice = row.target_price as number | null
    const baseline = olderPrices.length > 0 ? Math.min(...olderPrices, snapshotPrice) : snapshotPrice
    const isAtl = baseline - price >= 2
    const meetsTarget = targetPrice != null && price <= targetPrice
    if (!isAtl && !meetsTarget) continue

    const lastNotif = lastNotifMap.get(key)
    if (lastNotif) {
      const dropPct = ((lastNotif.price - price) / lastNotif.price) * 100
      const cooldownExpired = Date.now() - new Date(lastNotif.notifiedAt).getTime() > COOLDOWN_MS
      const urgencyOverride = dropPct >= URGENCY_DROP_PCT
      const normalRenotify = cooldownExpired && dropPct >= NORMAL_DROP_PCT
      if (!urgencyOverride && !normalRenotify) continue
    }

    atlInserts.push({ user_id: row.user_id, tcg_product_id: row.tcg_product_id, notified_price: price, notified_at: now, is_atl: isAtl })
  }

  if (atlInserts.length > 0) {
    const { error: atlError } = await supabase.from('sealed_atl_notifications').insert(atlInserts)
    if (atlError) throw new Error(`Failed to write ATL notifications: ${atlError.message}`)

    // Send emails to opted-in users
    const affectedUserIds = [...new Set(atlInserts.map(r => r.user_id))]
    const { data: optedIn } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('email_sealed_alerts', true)
      .in('user_id', affectedUserIds)

    const optedInSet = new Set((optedIn ?? []).map(r => r.user_id))
    if (optedInSet.size > 0) {
      const productDetailsMap = new Map(
        (sealedRows ?? []).map(r => [r.tcg_product_id as number, r])
      )

      const byUser = new Map<string, typeof atlInserts>()
      for (const insert of atlInserts) {
        if (!optedInSet.has(insert.user_id)) continue
        const arr = byUser.get(insert.user_id) ?? []
        arr.push(insert)
        byUser.set(insert.user_id, arr)
      }

      for (const [userId, inserts] of byUser) {
        try {
          const { data: userAuth } = await supabase.auth.admin.getUserById(userId)
          const email = userAuth?.user?.email
          if (!email) continue

          const products: SealedAlertProduct[] = inserts.map(ins => {
            const details = productDetailsMap.get(ins.tcg_product_id)
            const lastNotif = lastNotifMap.get(`${userId}:${ins.tcg_product_id}`)
            return {
              productName: details?.product_name ?? `Product #${ins.tcg_product_id}`,
              setName: details?.set_name ?? '',
              imageUrl: details?.image_url ?? null,
              currentPrice: ins.notified_price,
              lastNotifiedPrice: lastNotif?.price ?? null,
              targetPrice: (details?.target_price as number | null) ?? null,
              isAtl: ins.is_atl,
            }
          })

          await sendSealedAlertEmail(email, products)
        } catch (err) {
          console.error(`Failed to send alert email for user ${userId}:`, err)
        }
      }
    }
  }

  await setSealedCronTimestamp()

  return { products: uniqueProductIds.length, pricesFetched, historyRows: historyInserts.length, atlRows: atlInserts.length }
}
