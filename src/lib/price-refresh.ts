import { createServiceClient } from '@/lib/supabase/service'
import { ScryfallCard, getPrice, getPriceByFoilType, sleep } from '@/lib/scryfall'
import { getCached, setCached, setManapoolPrice, getCachedPriceByFoilType, cacheKey, setCronTimestamp, CacheEntry } from '@/lib/cache'
import { fetchManapoolSinglePrices } from '@/lib/manapool'
import { fetchTcgPlayerPrice } from '@/lib/tcgplayer'
import { sendAlertEmail, type AlertItem } from '@/lib/email'

const BATCH_SIZE = 75
const BATCH_DELAY = 100

const ATL_MIN_DELTA = 2
const ATL_WINDOW_MS = 24 * 60 * 60 * 1000
const COOLDOWN_MS = 8 * 60 * 60 * 1000
const NORMAL_DROP_PCT = 5
const URGENCY_DROP_PCT = 15

type ScryfallIdentifier = { id: string } | { name: string; set?: string }

async function fetchCollection(identifiers: ScryfallIdentifier[]): Promise<{ data: ScryfallCard[]; not_found: ScryfallIdentifier[] }> {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'SpencerMTGDashboard/1.0' },
    body: JSON.stringify({ identifiers }),
  })
  if (!res.ok) return { data: [], not_found: identifiers }
  return res.json()
}

export interface RefreshResult {
  binderCount: number
  wishlistCount: number
  uniqueCards: number
  fetched: number
  usersUpdated: number
}

export async function refreshAllPrices(): Promise<RefreshResult> {
  const supabase = createServiceClient()

  const [{ data: binderRows }, { data: wishlistRows }] = await Promise.all([
    supabase.from('binder_cards').select('user_id, display_name, base_name, set_code, scryfall_id, foil_type, snapshot_price'),
    supabase.from('wishlist_singles').select('user_id, name, set_code, scryfall_id, tcgplayer_id, snapshot_price, target_price'),
  ])

  type CardRef = { baseName: string; setCode: string | null; scryfallId: string | null }
  const uniqueCards = new Map<string, CardRef>()

  for (const row of binderRows ?? []) {
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    if (!uniqueCards.has(key)) uniqueCards.set(key, { baseName: row.base_name, setCode: row.set_code, scryfallId: row.scryfall_id })
  }
  for (const row of wishlistRows ?? []) {
    const key = cacheKey(row.name, row.scryfall_id ?? row.set_code ?? '')
    if (!uniqueCards.has(key)) uniqueCards.set(key, { baseName: row.name, setCode: row.set_code, scryfallId: row.scryfall_id })
  }

  // Build reverse lookup maps for matching collection results back to cache keys
  const idToKey = new Map<string, string>()
  const nameSetToKey = new Map<string, string>()
  const identifiers: ScryfallIdentifier[] = []
  for (const [key, card] of uniqueCards.entries()) {
    if (card.scryfallId) {
      idToKey.set(card.scryfallId, key)
      identifiers.push({ id: card.scryfallId })
    } else {
      const nsKey = `${card.baseName.toLowerCase()}:${(card.setCode ?? '').toLowerCase()}`
      nameSetToKey.set(nsKey, key)
      identifiers.push(card.setCode ? { name: card.baseName, set: card.setCode } : { name: card.baseName })
    }
  }

  let fetched = 0
  const scryfallIdToTcgplayerId = new Map<string, number>()

  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY)
    const batch = identifiers.slice(i, i + BATCH_SIZE)
    const { data: cards } = await fetchCollection(batch)

    for (const scryfallCard of cards) {
      const key = idToKey.get(scryfallCard.id)
        ?? nameSetToKey.get(`${scryfallCard.name.toLowerCase()}:${scryfallCard.set.toLowerCase()}`)
      if (!key) continue

      if (scryfallCard.tcgplayer_id) scryfallIdToTcgplayerId.set(scryfallCard.id, scryfallCard.tcgplayer_id)

      const price = getPrice(scryfallCard, false)
      const foilPrice = getPrice(scryfallCard, true)
      const etchedPrice = getPriceByFoilType(scryfallCard, 'etched')
      const imageUrl = scryfallCard.image_uris?.normal ?? scryfallCard.card_faces?.[0]?.image_uris?.normal ?? null
      await setCached(key, price, foilPrice, imageUrl, {
        setName: scryfallCard.set_name ?? undefined,
        setCode: scryfallCard.set ?? undefined,
        rarity: scryfallCard.rarity ?? undefined,
        typeLine: scryfallCard.type_line ?? undefined,
        etchedPrice,
      })
      fetched++
    }
  }

  // Backfill tcgplayer_id for wishlist cards that are missing it
  const wishlistBackfill = (wishlistRows ?? []).filter(
    r => !r.tcgplayer_id && r.scryfall_id && scryfallIdToTcgplayerId.has(r.scryfall_id)
  )
  for (const row of wishlistBackfill) {
    await supabase.from('wishlist_singles')
      .update({ tcgplayer_id: scryfallIdToTcgplayerId.get(row.scryfall_id!) })
      .eq('scryfall_id', row.scryfall_id!)
  }

  // Calculate per-user binder totals and card history
  const userTotals = new Map<string, number>()
  const userCounts = new Map<string, number>()
  const binderCardHistory: { user_id: string; display_name: string; date: string; price: number }[] = []
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const bucket4h = String(Math.floor(now.getUTCHours() / 4) * 4).padStart(2, '0')
  const dateBucket4h = `${today}T${bucket4h}`

  for (const row of binderRows ?? []) {
    userCounts.set(row.user_id, (userCounts.get(row.user_id) ?? 0) + 1)
    const key = cacheKey(row.base_name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    if (!cached) continue
    const price = getCachedPriceByFoilType(cached, row.foil_type ?? 'none')
    if (price == null) continue
    userTotals.set(row.user_id, (userTotals.get(row.user_id) ?? 0) + price)
    binderCardHistory.push({ user_id: row.user_id, display_name: row.display_name, date: today, price: parseFloat(price.toFixed(2)) })
  }

  const HISTORY_MIN_DELTA = 0.25

  for (const [userId, total] of userTotals) {
    const newTotal = parseFloat(total.toFixed(2))
    const { data: lastEntry } = await supabase
      .from('binder_history')
      .select('total')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastTotal = lastEntry?.total ?? null
    if (lastTotal === null || Math.abs(newTotal - lastTotal) >= HISTORY_MIN_DELTA) {
      await supabase.from('binder_history').insert({
        user_id: userId,
        date: today,
        total: newTotal,
        card_count: userCounts.get(userId) ?? null,
      })
    }
  }

  if (binderCardHistory.length > 0) {
    await supabase.from('binder_card_history').upsert(binderCardHistory, { onConflict: 'user_id,display_name,date' })
  }

  // Fetch Manapool prices for all wishlisted cards and store in cache
  const wishlistScryfallIds = [...new Set(
    (wishlistRows ?? []).filter(r => r.scryfall_id).map(r => r.scryfall_id as string)
  )]
  const manapoolPrices = new Map<string, { price: number | null; url: string }>()
  if (wishlistScryfallIds.length > 0) {
    const fetched = await fetchManapoolSinglePrices(wishlistScryfallIds)
    await Promise.all(
      wishlistScryfallIds.map(async scryfallId => {
        const row = (wishlistRows ?? []).find(r => r.scryfall_id === scryfallId)
        if (!row) return
        const key = cacheKey(row.name, scryfallId)
        const mp = fetched.get(scryfallId)
        manapoolPrices.set(scryfallId, { price: mp?.price ?? null, url: mp?.url ?? '' })
        await setManapoolPrice(key, mp?.price ?? null, mp?.url ?? null)
      })
    )
  }

  // Per-card wishlist history — use lowest of Scryfall, Manapool, and TCGPlayer listings
  const wishlistCardHistory: { user_id: string; card_name: string; date: string; price: number }[] = []
  const wishlistRowPrices = new Map<string, { price: number; imageUrl: string | null; setName: string | null }>()
  for (const row of wishlistRows ?? []) {
    const key = cacheKey(row.name, row.scryfall_id ?? row.set_code ?? '')
    const cached = await getCached(key)
    if (!cached || cached.price == null) continue
    const scryfallPrice = cached.price
    const manapoolPrice = row.scryfall_id ? (manapoolPrices.get(row.scryfall_id)?.price ?? null) : null
    const tcgId = row.tcgplayer_id ?? scryfallIdToTcgplayerId.get(row.scryfall_id ?? '') ?? null
    const tcgPrice = tcgId ? await fetchTcgPlayerPrice(tcgId) : null
    if (tcgId) await sleep(300)
    const price = parseFloat(Math.min(
      scryfallPrice,
      manapoolPrice ?? Infinity,
      tcgPrice ?? Infinity,
    ).toFixed(2))
    wishlistCardHistory.push({ user_id: row.user_id, card_name: row.name, date: dateBucket4h, price })
    wishlistRowPrices.set(`${row.user_id}:${row.name}`, { price, imageUrl: cached.imageUrl ?? null, setName: cached.setName ?? null })
  }

  if (wishlistCardHistory.length > 0) {
    await supabase.from('wishlist_card_history').upsert(wishlistCardHistory, { onConflict: 'user_id,card_name,date' })
  }

  // ATL / target-price alerts for singles
  const singleCardNames = [...new Set((wishlistRows ?? []).map(r => r.name))]
  const atlCutoff = new Date(Date.now() - ATL_WINDOW_MS).toISOString()

  const { data: olderWishlistHistory } = singleCardNames.length > 0 ? await supabase
    .from('wishlist_card_history')
    .select('user_id, card_name, price, date')
    .in('card_name', singleCardNames)
    : { data: [] as { user_id: string; card_name: string; price: number; date: string }[] }

  const olderWishlistPricesMap = new Map<string, number[]>()
  for (const row of olderWishlistHistory ?? []) {
    if (new Date(row.date).getTime() >= new Date(atlCutoff).getTime()) continue
    const key = `${row.user_id}:${row.card_name}`
    const arr = olderWishlistPricesMap.get(key) ?? []
    arr.push(row.price)
    olderWishlistPricesMap.set(key, arr)
  }

  const { data: lastWishlistNotifications } = singleCardNames.length > 0 ? await supabase
    .from('wishlist_atl_notifications')
    .select('user_id, card_name, notified_price, notified_at')
    .in('card_name', singleCardNames)
    .order('notified_at', { ascending: false })
    : { data: [] as { user_id: string; card_name: string; notified_price: number; notified_at: string }[] }

  const lastWishlistNotifMap = new Map<string, { price: number; notifiedAt: string }>()
  for (const row of lastWishlistNotifications ?? []) {
    const key = `${row.user_id}:${row.card_name}`
    if (!lastWishlistNotifMap.has(key)) lastWishlistNotifMap.set(key, { price: row.notified_price, notifiedAt: row.notified_at })
  }

  const wishlistAtlInserts: { user_id: string; card_name: string; notified_price: number; notified_at: string; is_atl: boolean }[] = []
  const notifiedAt = new Date().toISOString()
  for (const row of wishlistRows ?? []) {
    const priceInfo = wishlistRowPrices.get(`${row.user_id}:${row.name}`)
    if (!priceInfo) continue
    const price = priceInfo.price
    const key = `${row.user_id}:${row.name}`
    const olderPrices = olderWishlistPricesMap.get(key) ?? []
    const snapshotPrice = row.snapshot_price ?? 0
    const targetPrice = row.target_price as number | null
    const baseline = olderPrices.length > 0 ? Math.min(...olderPrices, snapshotPrice) : snapshotPrice
    const isAtl = baseline - price >= ATL_MIN_DELTA
    const meetsTarget = targetPrice != null && price <= targetPrice
    if (!isAtl && !meetsTarget) continue

    const lastNotif = lastWishlistNotifMap.get(key)
    if (lastNotif) {
      const dropPct = ((lastNotif.price - price) / lastNotif.price) * 100
      const cooldownExpired = Date.now() - new Date(lastNotif.notifiedAt).getTime() > COOLDOWN_MS
      const urgencyOverride = dropPct >= URGENCY_DROP_PCT
      const normalRenotify = cooldownExpired && dropPct >= NORMAL_DROP_PCT
      if (!urgencyOverride && !normalRenotify) continue
    }

    wishlistAtlInserts.push({ user_id: row.user_id, card_name: row.name, notified_price: price, notified_at: notifiedAt, is_atl: isAtl })
  }

  if (wishlistAtlInserts.length > 0) {
    await supabase.from('wishlist_atl_notifications').insert(wishlistAtlInserts)

    const affectedUserIds = [...new Set(wishlistAtlInserts.map(r => r.user_id))]
    const { data: optedIn } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('email_singles_alerts', true)
      .in('user_id', affectedUserIds)

    const optedInSet = new Set((optedIn ?? []).map(r => r.user_id))
    if (optedInSet.size > 0) {
      const rowDetailsMap = new Map((wishlistRows ?? []).map(r => [`${r.user_id}:${r.name}`, r]))

      const byUser = new Map<string, typeof wishlistAtlInserts>()
      for (const insert of wishlistAtlInserts) {
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

          const cards: AlertItem[] = inserts.map(ins => {
            const details = rowDetailsMap.get(`${userId}:${ins.card_name}`)
            const priceInfo = wishlistRowPrices.get(`${userId}:${ins.card_name}`)
            const lastNotif = lastWishlistNotifMap.get(`${userId}:${ins.card_name}`)
            return {
              name: ins.card_name,
              setName: priceInfo?.setName ?? details?.set_code?.toUpperCase() ?? '',
              imageUrl: priceInfo?.imageUrl ?? null,
              currentPrice: ins.notified_price,
              lastNotifiedPrice: lastNotif?.price ?? null,
              targetPrice: (details?.target_price as number | null) ?? null,
              isAtl: ins.is_atl,
            }
          })

          await sendAlertEmail(email, cards, 'singles')
        } catch (err) {
          console.error(`Failed to send singles alert email for user ${userId}:`, err)
        }
      }
    }
  }

  await setCronTimestamp()

  return {
    binderCount: binderRows?.length ?? 0,
    wishlistCount: wishlistRows?.length ?? 0,
    uniqueCards: uniqueCards.size,
    fetched,
    usersUpdated: userTotals.size,
  }
}
