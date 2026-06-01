'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CollectionChart from '@/components/CollectionChart'
import OnboardingModal from '@/components/OnboardingModal'

interface Card {
  name: string
  mana_cost?: string
  type_line: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  set_name: string
  image_uris?: { normal: string }
  card_faces?: { name: string; oracle_text?: string; image_uris?: { normal: string } }[]
  prices: { usd?: string | null; usd_foil?: string | null }
}

interface HighlightCard {
  displayName: string
  snapshotPrice: number
  currentPrice: number
  pct: number
  imageUrl: string | null
  isAtl?: boolean
  productId?: number
}

const LS_SEALED_DISMISSED = 'tnk:sealed:dismissed'
const LS_WISHLIST_DISMISSED = 'tnk:wishlist:dismissed'
const DISMISS_DELTA = 0.25

function getDismissed(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(LS_SEALED_DISMISSED) ?? '{}') } catch { return {} }
}

function isSealedDismissed(productId: number, currentPrice: number): boolean {
  const d = getDismissed()[productId]
  return d != null && currentPrice >= d - DISMISS_DELTA
}

function dismissSealed(productId: number, price: number) {
  const next = { ...getDismissed(), [productId]: price }
  localStorage.setItem(LS_SEALED_DISMISSED, JSON.stringify(next))
}

function getWishlistDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_WISHLIST_DISMISSED) ?? '{}') } catch { return {} }
}

function isWishlistDismissed(displayName: string, currentPrice: number): boolean {
  const d = getWishlistDismissed()[displayName]
  return d != null && currentPrice >= d - DISMISS_DELTA
}

function dismissWishlist(displayName: string, price: number) {
  const next = { ...getWishlistDismissed(), [displayName]: price }
  localStorage.setItem(LS_WISHLIST_DISMISSED, JSON.stringify(next))
}

interface HistoryPoint {
  date: string
  total: number
  card_count?: number | null
}


function formatRelativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const LS_HIGHLIGHTS = 'tnk:highlights'
const LS_HISTORY = 'tnk:history'
const LS_RECENT = 'tnk:recent'

export default function HomePage() {
  const router = useRouter()
  const [card, setCard] = useState<Card | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [topGainers, setTopGainers] = useState<HighlightCard[]>([])
  const [wishlistDrops, setWishlistDrops] = useState<HighlightCard[]>([])
  const [sealedDrops, setSealedDrops] = useState<HighlightCard[]>([])
  const [totalDelta, setTotalDelta] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    try { const c = localStorage.getItem(LS_HIGHLIGHTS); return c ? (JSON.parse(c).totalDelta ?? null) : null } catch { return null }
  })
  const [binderHistory, setBinderHistory] = useState<HistoryPoint[]>(() => {
    if (typeof window === 'undefined') return []
    try { const c = localStorage.getItem(LS_HISTORY); return c ? JSON.parse(c) : [] } catch { return [] }
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [faceIndex, setFaceIndex] = useState(0)
  const [isDesktop, setIsDesktop] = useState(true)
  const [recentCards, setRecentCards] = useState<{ displayName: string; setCode: string; snapshotPrice: number; purchasePrice: number | null; currentPrice: number | null; imageUrl: string | null; dateAdded: string | null }[]>([])
  const [cardFetchedAt, setCardFetchedAt] = useState<Date | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dismissedSealed, setDismissedSealed] = useState<Record<number, number>>({})
  const [dismissedWishlist, setDismissedWishlist] = useState<Record<string, number>>({})

  useEffect(() => {
    setDismissedSealed(getDismissed())
    setDismissedWishlist(getWishlistDismissed())
  }, [])

  function fetchHighlights() {
    const cached = localStorage.getItem(LS_HIGHLIGHTS)
    if (cached) {
      const data = JSON.parse(cached)
      setTopGainers(data.topGainers ?? [])
      setWishlistDrops(data.wishlistDrops ?? [])
      setSealedDrops(data.sealedDrops ?? [])
      if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated))
      if (data.totalDelta != null) setTotalDelta(data.totalDelta)
    }
    fetch('/api/highlights')
      .then(r => r.json())
      .then(data => {
        setTopGainers(data.topGainers ?? [])
        setWishlistDrops(data.wishlistDrops ?? [])
        setSealedDrops(data.sealedDrops ?? [])
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated))
        if (data.totalDelta != null) setTotalDelta(data.totalDelta)
        localStorage.setItem(LS_HIGHLIGHTS, JSON.stringify(data))
      })
  }

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => { if (!d.onboarded) setShowOnboarding(true) })
    fetchHighlights()

    const cachedRecent = localStorage.getItem(LS_RECENT)
    if (cachedRecent) setRecentCards(JSON.parse(cachedRecent))
    fetch('/api/binder/recent').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setRecentCards(data)
        localStorage.setItem(LS_RECENT, JSON.stringify(data))
      }
    })

    fetch('/api/binder/history').then(r => r.json()).then(h => {
      if (Array.isArray(h)) {
        setBinderHistory(h)
        localStorage.setItem(LS_HISTORY, JSON.stringify(h))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function fetchCard(url = '/api/card-of-the-day') {
    const now = new Date()
    const hourKey = `tnk:card:${now.toISOString().split('T')[0]}:${now.getHours()}`
    if (url === '/api/card-of-the-day') {
      const cached = localStorage.getItem(hourKey)
      if (cached) {
        const data = JSON.parse(cached)
        setCard(data.card)
        setDisplayName(data.displayName)
        setCardFetchedAt(data.fetchedAt ? new Date(data.fetchedAt) : null)
        setFaceIndex(0)
        setLoading(false)
        return
      }
    }
    setLoading(true)
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.card) {
          setCard(data.card)
          setDisplayName(data.displayName)
          setFaceIndex(0)
          setLoading(false)
          if (url === '/api/card-of-the-day') {
            const fetchedAt = new Date().toISOString()
            setCardFetchedAt(new Date(fetchedAt))
            localStorage.setItem(hourKey, JSON.stringify({ ...data, fetchedAt }))
          } else {
            setCardFetchedAt(null)
          }
        }
      })
  }

  useEffect(() => { fetchCard() }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const isDoubleFaced = !!(card?.card_faces && card.card_faces.length >= 2 && card.card_faces[0].image_uris && card.card_faces[1].image_uris)
  const image = isDoubleFaced
    ? card!.card_faces![faceIndex].image_uris!.normal
    : (card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal)
  const oracle = card?.oracle_text ?? card?.card_faces?.map(f => `${f.name}\n${f.oracle_text ?? ''}`).join('\n\n')

  const sidebar = true

  const currentTotal = binderHistory.length > 0 ? binderHistory[binderHistory.length - 1].total : null
  const firstTotal = binderHistory.length > 1 ? binderHistory[0].total : null
  const totalDiff = currentTotal != null && firstTotal != null ? currentTotal - firstTotal : null


  const binderChart = binderHistory.length > 0 ? (
    <div className="bg-stone-900 border-2 border-amber-900/40 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Binder Value</p>
          <p className="text-2xl font-bold text-stone-100">${currentTotal!.toFixed(2)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {totalDelta != null && (
            <span className={`text-sm font-mono font-semibold ${totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalDelta >= 0 ? '▲' : '▼'} ${Math.abs(totalDelta).toFixed(2)} vs cost
            </span>
          )}
          {totalDiff != null && (
            <span className="text-xs font-mono text-stone-500">
              {totalDiff >= 0 ? '▲' : '▼'} ${Math.abs(totalDiff).toFixed(2)} all time
            </span>
          )}
        </div>
      </div>
      <CollectionChart data={binderHistory} />
    </div>
  ) : (
    <div className="bg-stone-900 border-2 border-stone-800 rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[140px]">
      <p className="text-sm font-semibold text-stone-500">No collection data yet</p>
      <p className="text-xs text-stone-600 text-center">Add cards to your <Link href="/binder" className="text-amber-600 hover:text-amber-500">binder</Link> to start tracking your collection value.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      {showOnboarding && <OnboardingModal onDismiss={() => setShowOnboarding(false)} />}

      {/* On mobile: chart sits above the sidebar (gainers/drops) */}
      {!isDesktop && binderChart}

      <div className="flex flex-col lg:flex-row gap-8 items-start">

      {/* Main content — order-2 on mobile so sidebar renders above it */}
      <div className="flex flex-col gap-8 flex-1 min-w-0 w-full order-2 lg:order-1">

        {/* On desktop: chart lives here, level with the sidebar */}
        {isDesktop && binderChart}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-600 uppercase tracking-widest mb-1">Card of the Hour</p>
            <p className="text-stone-500 text-sm">
              {today}{cardFetchedAt ? ` · ${cardFetchedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
            </p>
          </div>
          {!loading && card && (
            <button
              onClick={() => fetchCard('/api/random-card')}
              className="text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 transition-colors rounded-lg px-3 py-1.5"
            >
              Random Card
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-full max-w-[224px] mx-auto sm:mx-0 sm:w-56 aspect-[5/7] bg-stone-800 rounded-xl animate-pulse flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-3 pt-2">
              <div className="h-6 bg-stone-800 rounded animate-pulse w-1/2" />
              <div className="h-4 bg-stone-800 rounded animate-pulse w-1/3" />
              <div className="h-24 bg-stone-800 rounded animate-pulse mt-2" />
            </div>
          </div>
        ) : card && (
          <>

            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col items-center sm:items-start gap-2 flex-shrink-0">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={card.name} className="w-full max-w-[224px] sm:w-56 rounded-xl shadow-2xl" />
                )}
                {isDoubleFaced && (
                  <button
                    onClick={() => setFaceIndex(i => i === 0 ? 1 : 0)}
                    className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                  >
                    ↻ {card.card_faces![faceIndex === 0 ? 1 : 0].name}
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-3 flex-wrap">
                  <h2 className="text-xl font-bold text-stone-100">{displayName}</h2>
                  {card.mana_cost && (
                    <span className="text-stone-400 font-mono text-sm mt-1">{card.mana_cost}</span>
                  )}
                </div>

                <p className="text-stone-400 text-sm mb-4">{card.type_line}</p>

                {oracle && (
                  <div className="bg-stone-900 border-2 border-amber-900/30 rounded-lg p-4 mb-4">
                    {oracle.split('\n').map((line, i) => (
                      <p key={i} className={`text-sm text-stone-300 ${line === '' ? 'mt-2' : ''}`}>{line}</p>
                    ))}
                  </div>
                )}

                {(card.power || card.loyalty) && (
                  <p className="text-stone-400 text-sm mb-3">
                    {card.power ? `P/T: ${card.power}/${card.toughness}` : `Loyalty: ${card.loyalty}`}
                  </p>
                )}

                <div className="flex gap-6 text-sm">
                  {card.prices.usd && (
                    <div>
                      <span className="text-stone-500">Price</span>
                      <p className="text-green-400 font-mono font-medium">${card.prices.usd}</p>
                    </div>
                  )}
                  {card.prices.usd_foil && (
                    <div>
                      <span className="text-stone-500">Foil</span>
                      <p className="text-amber-500 font-mono font-medium">${card.prices.usd_foil}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-stone-500">Set</span>
                    <p className="text-stone-300">{card.set_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {recentCards.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-stone-600 uppercase tracking-widest font-semibold">Recently Added</p>
                <div className="flex flex-col gap-1">
                  {recentCards.map(c => (
                    <div key={c.displayName} className="flex items-center gap-3 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2">
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.displayName} className="w-7 rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-200 font-medium truncate">{c.displayName}</p>
                        {c.setCode && <p className="text-xs text-stone-600 uppercase">{c.setCode}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono text-stone-300">
                          {c.currentPrice != null ? `$${c.currentPrice.toFixed(2)}` : `$${c.snapshotPrice.toFixed(2)}`}
                        </p>
                        {c.currentPrice != null && (() => {
                          const basis = c.purchasePrice ?? c.snapshotPrice
                          if (basis <= 0) return null
                          const pct = ((c.currentPrice - basis) / basis) * 100
                          if (Math.abs(pct) < 0.05) return null
                          return (
                            <p className={`text-xs font-mono ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar — order-1 on mobile so it renders above main content */}
      {sidebar && (
        <div id="sidebar" className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6 order-1 lg:order-2">
          <div id="sidebar-price-data" className="hidden lg:flex bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 flex-col gap-0.5">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Price Data</p>
            <p className="text-xs text-stone-400">
              {lastUpdated ? `Last updated ${formatRelativeTime(lastUpdated)}` : 'Not yet synced'}
            </p>
          </div>

          {topGainers.length === 0 && wishlistDrops.length === 0 && sealedDrops.length === 0 && (
            <p className="text-xs text-stone-600">Price highlights will appear here once you have cards in your <Link href="/binder" className="text-amber-700 hover:text-amber-600">binder</Link> and <Link href="/wishlist" className="text-amber-700 hover:text-amber-600">wishlist</Link>.</p>
          )}

          {lastUpdated && (
            <p className="lg:hidden text-xs text-stone-600 text-right -mt-2">
              Prices updated {formatRelativeTime(lastUpdated)}
            </p>
          )}

          {sealedDrops.filter(c => c.productId != null && !isSealedDismissed(c.productId, c.currentPrice)).length > 0 && (
            <div id="sidebar-sealed-drops">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Sealed All-Time Low</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {sealedDrops.filter(c => c.productId != null && !isSealedDismissed(c.productId, c.currentPrice)).map(c => {
                  const suffix = c.displayName.includes(' - ') ? c.displayName.slice(c.displayName.indexOf(' - ') + 3) : c.displayName
                  return (
                    <div key={c.displayName} className="group relative">
                      <button
                        onClick={() => router.push('/wishlist#wishlist-sealed')}
                        className="flex items-center gap-2 bg-stone-900 rounded-lg px-2.5 py-2 hover:bg-stone-800 transition-colors text-left w-full"
                      >
                        {c.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt={suffix} className="w-7 h-7 object-cover rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-stone-200 font-medium truncate">{suffix}</p>
                          <p className="text-xs text-stone-600 font-mono">${c.snapshotPrice.toFixed(2)} → ${c.currentPrice.toFixed(2)}</p>
                        </div>
                        <span className="hidden sm:block sm:group-hover:opacity-0 transition-opacity text-xs font-bold text-green-400 font-mono shrink-0">↓ ATL</span>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); dismissSealed(c.productId!, c.currentPrice); setDismissedSealed(getDismissed()) }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {wishlistDrops.filter(c => !isWishlistDismissed(c.displayName, c.currentPrice)).length > 0 && (
            <div id="sidebar-wishlist-drops">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Wishlist Drops</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {wishlistDrops.filter(c => !isWishlistDismissed(c.displayName, c.currentPrice)).map(c => (
                  <div key={c.displayName} className="group relative">
                    <button
                      onClick={() => router.push('/wishlist')}
                      className="flex items-center gap-2 bg-stone-900 rounded-lg px-2.5 py-2 hover:bg-stone-800 transition-colors text-left w-full"
                    >
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.displayName} className="w-7 rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-stone-200 font-medium truncate">{c.displayName}</p>
                        <p className="text-xs text-stone-600 font-mono">${c.snapshotPrice.toFixed(2)} → ${c.currentPrice.toFixed(2)}</p>
                      </div>
                      <span className="hidden sm:block sm:group-hover:opacity-0 transition-opacity text-xs font-bold text-red-400 font-mono shrink-0">▼{Math.abs(c.pct).toFixed(1)}%</span>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); dismissWishlist(c.displayName, c.currentPrice); setDismissedWishlist(getWishlistDismissed()) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topGainers.length > 0 && (
            <div id="sidebar-top-gainers">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Top Gainers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {topGainers.map(c => (
                  <button
                    key={c.displayName}
                    onClick={() => router.push(`/binder?expand=${encodeURIComponent(c.displayName)}`)}
                    className="flex items-center gap-2 bg-stone-900 rounded-lg px-2.5 py-2 hover:bg-stone-800 transition-colors text-left w-full"
                  >
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.displayName} className="w-7 rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-stone-200 font-medium truncate">{c.displayName}</p>
                      <p className="text-xs text-stone-600 font-mono">${c.snapshotPrice.toFixed(2)} → ${c.currentPrice.toFixed(2)}</p>
                    </div>
                    <span className="text-xs font-bold text-green-400 font-mono shrink-0">▲{c.pct.toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <a
            href="https://scryfall.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 rounded-lg px-2.5 py-2 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 transition-colors w-full"
          >
            Open Scryfall ↗
          </a>
          <a
            href="https://botbox.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 rounded-lg px-2.5 py-2 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 transition-colors w-full"
          >
            Feeling bored? 🎲
          </a>
        </div>
      )}
      </div>
    </div>
  )
}
