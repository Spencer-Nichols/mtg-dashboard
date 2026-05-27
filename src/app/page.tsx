'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
}

interface HistoryPoint {
  date: string
  total: number
}

function CollectionChart({ data }: { data: HistoryPoint[] }) {
  if (data.length === 0) return null

  const width = 600
  const height = 120
  const padX = 48
  const padY = 16

  const totals = data.map(d => d.total)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const range = max - min || 1

  const x = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2)
  const y = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2)

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ')
  const area = `M${x(0).toFixed(1)},${height} ` +
    data.map((d, i) => `L${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ') +
    ` L${x(data.length - 1).toFixed(1)},${height} Z`

  const trend = data.length > 1 ? data[data.length - 1].total - data[0].total : 0
  const color = trend >= 0 ? '#4ade80' : '#f87171'

  const yLabels = [min, (min + max) / 2, max]
  const xIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
          <text x={padX - 4} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#475569">${Math.round(v)}</text>
        </g>
      ))}
      {xIndices.map(i => (
        <text key={i} x={x(i)} y={height - 2} textAnchor="middle" fontSize="9" fill="#475569">
          {data[i].date.slice(5)}
        </text>
      ))}
      <path d={area} fill="url(#chartGrad)" />
      {data.length > 1
        ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        : <circle cx={x(0)} cy={y(data[0].total)} r="3" fill={color} />}
    </svg>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [card, setCard] = useState<Card | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [topGainers, setTopGainers] = useState<HighlightCard[]>([])
  const [wishlistDrops, setWishlistDrops] = useState<HighlightCard[]>([])
  const [binderHistory, setBinderHistory] = useState<HistoryPoint[]>([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState('')
  const [faceIndex, setFaceIndex] = useState(0)
  const [isDesktop, setIsDesktop] = useState(true)
  const [recentCards, setRecentCards] = useState<{ displayName: string; setCode: string; snapshotPrice: number; currentPrice: number | null; imageUrl: string | null; dateAdded: string | null }[]>([])
  const nextRefreshRef = useRef<Date | null>(null)

  const INTERVAL = 60 * 60 * 1000

  function fetchHighlights() {
    fetch('/api/highlights')
      .then(r => r.json())
      .then(data => {
        setTopGainers(data.topGainers ?? [])
        setWishlistDrops(data.wishlistDrops ?? [])
      })
  }

  useEffect(() => {
    const stored = localStorage.getItem('highlightsLastFetch')
    const lastFetch = stored ? parseInt(stored, 10) : 0
    const elapsed = Date.now() - lastFetch

    if (lastFetch && elapsed < INTERVAL) {
      setUpdatedAt(new Date(lastFetch))
      nextRefreshRef.current = new Date(lastFetch + INTERVAL)
    } else {
      const now = Date.now()
      localStorage.setItem('highlightsLastFetch', String(now))
      setUpdatedAt(new Date(now))
      nextRefreshRef.current = new Date(now + INTERVAL)
    }

    fetchHighlights()
    fetch('/api/binder/recent').then(r => r.json()).then(data => { if (Array.isArray(data)) setRecentCards(data) })

    const tick = setInterval(() => {
      if (!nextRefreshRef.current) return
      const diff = nextRefreshRef.current.getTime() - Date.now()
      if (diff <= 0) {
        const now = Date.now()
        localStorage.setItem('highlightsLastFetch', String(now))
        setUpdatedAt(new Date(now))
        nextRefreshRef.current = new Date(now + INTERVAL)
        fetchHighlights()
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`)
    }, 1000)

    return () => clearInterval(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/binder/history').then(r => r.json()).then(h => { if (Array.isArray(h)) setBinderHistory(h) })
  }, [])

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function fetchCard(url = '/api/card-of-the-day') {
    setLoading(true)
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.card) {
          setCard(data.card)
          setDisplayName(data.displayName)
          setFaceIndex(0)
          setLoading(false)
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

  const sidebar = topGainers.length > 0 || wishlistDrops.length > 0

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
        {totalDiff != null && (
          <span className={`text-sm font-mono font-semibold ${totalDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalDiff >= 0 ? '▲' : '▼'} ${Math.abs(totalDiff).toFixed(2)} all time
          </span>
        )}
      </div>
      <CollectionChart data={binderHistory} />
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-8">

      {/* On mobile: chart sits above the sidebar (gainers/drops) */}
      {!isDesktop && binderChart}

      <div className="flex flex-col lg:flex-row gap-8 items-start">

      {/* Main content — order-2 on mobile so sidebar renders above it */}
      <div className="flex flex-col gap-8 flex-1 min-w-0 w-full order-2 lg:order-1">

        {/* On desktop: chart lives here, level with the sidebar */}
        {isDesktop && binderChart}

        <div>
          <p className="text-xs text-stone-600 uppercase tracking-widest mb-1">Card of the Hour</p>
          <p className="text-stone-500 text-sm">{today}</p>
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

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => fetchCard('/api/random-card')}
                className="text-xs font-semibold text-amber-200 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 transition-colors rounded-lg px-3 py-1.5"
              >
                Random Card
              </button>
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
                        {c.currentPrice != null && c.snapshotPrice > 0 && (
                          <p className={`text-xs font-mono ${c.currentPrice >= c.snapshotPrice ? 'text-green-500' : 'text-red-500'}`}>
                            {c.currentPrice >= c.snapshotPrice ? '▲' : '▼'}{Math.abs(((c.currentPrice - c.snapshotPrice) / c.snapshotPrice) * 100).toFixed(1)}%
                          </p>
                        )}
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
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6 order-1 lg:order-2">
          <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Price Data</p>
            {updatedAt && (
              <p className="text-xs text-stone-400">
                Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {countdown && (
              <p className="text-sm font-mono text-amber-500 font-semibold">↻ {countdown}</p>
            )}
          </div>

          {topGainers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Top Gainers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {topGainers.map(c => (
                  <div key={c.displayName} className="flex items-center gap-2 bg-stone-900 rounded-lg px-2.5 py-2">
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.displayName} className="w-7 rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-stone-200 font-medium truncate">{c.displayName}</p>
                      <p className="text-xs text-stone-600 font-mono">${c.snapshotPrice.toFixed(2)} → ${c.currentPrice.toFixed(2)}</p>
                    </div>
                    <span className="text-xs font-bold text-green-400 font-mono shrink-0">▲{c.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wishlistDrops.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-2">Wishlist Drops</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {wishlistDrops.map(c => (
                  <button
                    key={c.displayName}
                    onClick={() => router.push('/binder?tab=wishlist')}
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
                    <span className="text-xs font-bold text-red-400 font-mono shrink-0">▼{Math.abs(c.pct).toFixed(1)}%</span>
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
