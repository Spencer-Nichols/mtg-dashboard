'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { KEYWORDS, KEYWORD_CATEGORIES } from '@/lib/keywords'
import type { BrewCard } from '@/app/api/search/brew/route'

interface CardFace {
  name: string
  mana_cost?: string
  oracle_text?: string
  image_uris?: { normal: string }
}

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
  card_faces?: CardFace[]
  prices: { usd?: string | null; usd_foil?: string | null }
}

interface SynergyCard {
  name: string
  lift: number
  inclusionRate: number
  numDecks: number
  owned: boolean
  imageUrl: string | null
  price: number | null
  typeLine: string | null
  setName: string | null
  rarity: string | null
}

type CardStatus = 'owned' | 'proxy' | 'not_owned'

const STATUS_STYLES: Record<CardStatus, string> = {
  owned: 'bg-green-900/50 text-green-300 border border-green-700',
  proxy: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  not_owned: 'bg-stone-800 text-stone-400 border border-stone-700',
}
const STATUS_LABELS: Record<CardStatus, string> = {
  owned: 'Owned', proxy: 'Proxy', not_owned: 'Not Owned',
}

const COLOR_CHIPS = [
  { symbol: 'W', label: 'White', bg: 'bg-amber-50',  text: 'text-amber-900', activeBg: 'bg-amber-100',  border: 'border-amber-300' },
  { symbol: 'U', label: 'Blue',  bg: 'bg-blue-600',  text: 'text-white',     activeBg: 'bg-blue-500',   border: 'border-blue-400'  },
  { symbol: 'B', label: 'Black', bg: 'bg-stone-700', text: 'text-stone-200', activeBg: 'bg-stone-600',  border: 'border-stone-500' },
  { symbol: 'R', label: 'Red',   bg: 'bg-red-700',   text: 'text-white',     activeBg: 'bg-red-600',    border: 'border-red-400'   },
  { symbol: 'G', label: 'Green', bg: 'bg-green-700', text: 'text-white',     activeBg: 'bg-green-600',  border: 'border-green-400' },
]

const CARD_TYPES = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land']
const CMC_PRESETS = [1, 2, 3, 4, 5, 7]
const MAX_PRICE_SLIDER = 50
const CLIENT_PAGE_SIZE = 24

const RARITY_COLOR: Record<string, string> = {
  mythic: 'text-orange-400', rare: 'text-yellow-400',
  uncommon: 'text-blue-400', common: 'text-stone-500',
}

function buildBrewQuery(
  keywords: string[], colors: Set<string>, activeType: string | null,
  maxCmc: number | null, maxPrice: number | null, raw: string,
  oracleText?: string,
): string {
  const parts: string[] = []
  for (const slug of keywords) parts.push(`function:${slug}`)
  if (raw.trim()) parts.push(raw.trim())
  if (oracleText?.trim()) parts.push(`o:"${oracleText.trim()}"`)
  if (colors.size > 0) parts.push(`color<=${[...colors].join('')}`)
  if (activeType) parts.push(`t:${activeType}`)
  if (maxCmc !== null) parts.push(`cmc<=${maxCmc}`)
  if (maxPrice !== null) parts.push(`usd<=${maxPrice}`)
  return parts.join(' ')
}

function KeywordLegend({ onInsert, activeKeywords }: {
  onInsert: (slug: string) => void
  activeKeywords: string[]
}) {
  return (
    <div className="space-y-4">
      {KEYWORD_CATEGORIES.map(cat => (
        <div key={cat}>
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">{cat}</p>
          <div className="flex flex-wrap gap-1.5">
            {KEYWORDS.filter(k => k.category === cat).map(kw => (
              <button
                key={kw.slug}
                onClick={() => onInsert(kw.slug)}
                className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                  activeKeywords.includes(kw.slug)
                    ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                }`}
              >
                {kw.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-stone-500 pt-1">Combine multiple to narrow results.</p>
    </div>
  )
}

function BrewResultCard({ card, onAddToWishlist, isAdding, isAdded }: {
  card: BrewCard
  onAddToWishlist: () => void
  isAdding: boolean
  isAdded: boolean
}) {
  const isOnWishlist = card.onWishlist || isAdded
  return (
    <div className="flex flex-col gap-1.5 group">
      <div className={`relative rounded-xl overflow-hidden shadow-lg transition-all ${card.owned ? 'ring-2 ring-green-600/60' : ''}`}>
        {card.imageUrl
          ? <img src={card.imageUrl} alt={card.name} className="w-full block" />
          : <div className="aspect-[5/7] bg-stone-800 rounded-xl flex items-center justify-center text-stone-600 text-xs p-2 text-center">{card.name}</div>}

        {card.owned && (
          <div className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm bg-green-900/80 text-green-300">
            Owned
          </div>
        )}
        {!card.owned && isOnWishlist && (
          <div className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm bg-amber-900/80 text-amber-300">
            {isAdded ? '✓ Added' : 'Wishlist'}
          </div>
        )}

        {isAdding && (
          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center">
            <p className="text-xs text-amber-400">Adding…</p>
          </div>
        )}
        {!card.owned && !isOnWishlist && !isAdding && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onAddToWishlist() }}
              className="text-xs px-3 py-1 rounded-full bg-stone-900/90 border-2 border-amber-700/50 text-amber-400 hover:bg-amber-900/40 transition-colors"
            >
              + Wishlist
            </button>
          </div>
        )}
      </div>

      <div className="px-0.5 flex flex-col gap-0.5">
        <p className="text-sm text-stone-200 font-semibold leading-tight">{card.name}</p>
        {card.typeLine && <p className="text-xs text-stone-500 leading-tight">{card.typeLine}</p>}
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-medium capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-500'}`}>{card.rarity}</p>
          {card.price != null && <p className="text-sm font-mono text-stone-300">${card.price.toFixed(2)}</p>}
        </div>
      </div>
    </div>
  )
}

function AccordionRow({ title, count, open, onToggle, children }: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-2 border-stone-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-900/50 text-sm text-stone-400 hover:text-stone-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300">
              {count}
            </span>
          )}
        </span>
        <span className="text-stone-600 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-stone-900/30 border-t-2 border-stone-800">
          {children}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  const [mode, setMode] = useState<'card' | 'brew'>('brew')

  // ── Card search state ─────────────────────────────────────
  const [query, setQuery] = useState('')
  const [card, setCard] = useState<Card | null>(null)
  const [candidates, setCandidates] = useState<Card[]>([])
  const [cardStatus, setCardStatus] = useState<CardStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [synergies, setSynergies] = useState<SynergyCard[]>([])
  const [synergyHeader, setSynergyHeader] = useState('')
  const [synergyLoading, setSynergyLoading] = useState(false)
  const [dropdown, setDropdown] = useState<{ name: string; type_line: string; price: string | null }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // ── Brew state ────────────────────────────────────────────
  const [brewRawQuery, setBrewRawQuery] = useState('')
  const [displayedQuery, setDisplayedQuery] = useState('')
  const [oracleText, setOracleText] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<string[]>([])
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [activeType, setActiveType] = useState<string | null>(null)
  const [maxCmc, setMaxCmc] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [priceSlider, setPriceSlider] = useState(MAX_PRICE_SLIDER)
  const [keywordsOpen, setKeywordsOpen] = useState(false)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [cmcOpen, setCmcOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)

  const [allFetchedCards, setAllFetchedCards] = useState<BrewCard[]>([])
  const [clientPage, setClientPage] = useState(1)
  const [scryfallPage, setScryfallPage] = useState(1)
  const [hasMoreScryfall, setHasMoreScryfall] = useState(false)
  const [brewTotal, setBrewTotal] = useState(0)
  const [brewLoading, setBrewLoading] = useState(false)
  const [brewError, setBrewError] = useState<string | null>(null)

  const [wishlistAdded, setWishlistAdded] = useState<Set<string>>(new Set())
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const cardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Brew core fetch ───────────────────────────────────────

  const runBrewFetch = useCallback(async (q: string, page: number, append: boolean) => {
    if (!q.trim()) {
      setAllFetchedCards([])
      setBrewTotal(0)
      setHasMoreScryfall(false)
      return
    }
    setBrewLoading(true)
    setBrewError(null)
    const res = await fetch(`/api/search/brew?q=${encodeURIComponent(q)}&page=${page}`)
    const data = await res.json()
    if (!res.ok) {
      setBrewError(data.error ?? 'No results found')
      if (!append) setAllFetchedCards([])
      setBrewTotal(0)
      setHasMoreScryfall(false)
    } else {
      setAllFetchedCards(prev => append ? [...prev, ...(data.cards ?? [])] : (data.cards ?? []))
      setBrewTotal(data.total ?? 0)
      setHasMoreScryfall(data.hasMore ?? false)
      setScryfallPage(page)
    }
    setBrewLoading(false)
  }, [])

  function scheduleFetch(q: string) {
    if (brewDebounceRef.current) clearTimeout(brewDebounceRef.current)
    setClientPage(1)
    setAllFetchedCards([])
    setScryfallPage(1)
    brewDebounceRef.current = setTimeout(() => runBrewFetch(q, 1, false), 700)
  }

  // Sync displayedQuery when filters change (not when user types — that's handleBrewRawInput)
  const brewRawQueryRef = useRef(brewRawQuery)
  useEffect(() => { brewRawQueryRef.current = brewRawQuery }, [brewRawQuery])

  useEffect(() => {
    const filterPart = buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, '', oracleText)
    const raw = brewRawQueryRef.current
    setDisplayedQuery(
      filterPart
        ? raw.trim() ? `${filterPart} ${raw.trim()}` : filterPart
        : raw
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeywords, activeColors, activeType, maxCmc, maxPrice, oracleText])

  // ── Brew filter handlers ──────────────────────────────────

  function toggleKeyword(slug: string) {
    const next = activeKeywords.includes(slug)
      ? activeKeywords.filter(k => k !== slug)
      : [...activeKeywords, slug]
    setActiveKeywords(next)
    scheduleFetch(buildBrewQuery(next, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText))
  }

  function toggleColor(symbol: string) {
    const next = new Set(activeColors)
    next.has(symbol) ? next.delete(symbol) : next.add(symbol)
    setActiveColors(next)
    scheduleFetch(buildBrewQuery(activeKeywords, next, activeType, maxCmc, maxPrice, brewRawQuery, oracleText))
  }

  function selectType(type: string) {
    const next = activeType === type ? null : type
    setActiveType(next)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, next, maxCmc, maxPrice, brewRawQuery, oracleText))
  }

  function setCmcFilter(val: number | null) {
    setMaxCmc(val)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, val, maxPrice, brewRawQuery, oracleText))
  }

  function handlePriceSlider(val: number) {
    setPriceSlider(val)
    const price = val < MAX_PRICE_SLIDER ? val : null
    setMaxPrice(price)
    if (brewDebounceRef.current) clearTimeout(brewDebounceRef.current)
    setClientPage(1)
    setAllFetchedCards([])
    setScryfallPage(1)
    brewDebounceRef.current = setTimeout(() => {
      runBrewFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, price, brewRawQuery, oracleText), 1, false)
    }, 500)
  }

  function handleBrewRawInput(val: string) {
    const filterPart = buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, '', oracleText)
    const extraTerms = filterPart && val.startsWith(filterPart)
      ? val.slice(filterPart.length).trimStart()
      : val
    setBrewRawQuery(extraTerms)
    setDisplayedQuery(val)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, extraTerms, oracleText))
  }

  function clearAllFilters() {
    setActiveKeywords([])
    setActiveColors(new Set())
    setActiveType(null)
    setMaxCmc(null)
    setMaxPrice(null)
    setPriceSlider(MAX_PRICE_SLIDER)
    setBrewRawQuery('')
    setDisplayedQuery('')
    setOracleText('')
    setAllFetchedCards([])
    setBrewTotal(0)
    setHasMoreScryfall(false)
    setClientPage(1)
    setScryfallPage(1)
    setBrewError(null)
  }

  // ── Pagination ────────────────────────────────────────────

  const visibleCards = allFetchedCards.slice((clientPage - 1) * CLIENT_PAGE_SIZE, clientPage * CLIENT_PAGE_SIZE)
  const totalClientPages = Math.max(1, Math.ceil(allFetchedCards.length / CLIENT_PAGE_SIZE))
  const hasNextPage = clientPage < totalClientPages || hasMoreScryfall

  async function goNextPage() {
    const nextPage = clientPage + 1
    if ((nextPage - 1) * CLIENT_PAGE_SIZE < allFetchedCards.length) {
      setClientPage(nextPage)
    } else if (hasMoreScryfall && !brewLoading) {
      await runBrewFetch(displayedQuery, scryfallPage + 1, true)
      setClientPage(nextPage)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPrevPage() {
    if (clientPage > 1) {
      setClientPage(p => p - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // ── Add to wishlist ───────────────────────────────────────

  async function addToWishlist(name: string) {
    setWishlistLoading(prev => new Set(prev).add(name))
    const res = await fetch('/api/wishlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setWishlistLoading(prev => { const s = new Set(prev); s.delete(name); return s })
    if (res.ok || res.status === 409) {
      setWishlistAdded(prev => new Set(prev).add(name))
    }
  }

  // ── Active filters ────────────────────────────────────────

  const activeFilters = [
    ...activeKeywords.map(slug => ({
      label: KEYWORDS.find(k => k.slug === slug)?.label ?? slug,
      onRemove: () => toggleKeyword(slug),
    })),
    ...[...activeColors].map(c => ({
      label: c,
      onRemove: () => toggleColor(c),
    })),
    ...(activeType ? [{ label: activeType.charAt(0).toUpperCase() + activeType.slice(1), onRemove: () => selectType(activeType) }] : []),
    ...(maxCmc !== null ? [{ label: `CMC ≤ ${maxCmc}`, onRemove: () => setCmcFilter(null) }] : []),
    ...(maxPrice !== null ? [{ label: `≤ $${maxPrice}`, onRemove: () => { handlePriceSlider(MAX_PRICE_SLIDER) } }] : []),
    ...(oracleText.trim() ? [{ label: `o: "${oracleText.trim()}"`, onRemove: () => { setOracleText(''); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, '')) } }] : []),
  ]

  // ── Card search handlers ──────────────────────────────────

  function handleCardInput(value: string) {
    setQuery(value)
    setDropdown([])
    if (cardDebounceRef.current) clearTimeout(cardDebounceRef.current)
    if (!value.trim()) { setShowDropdown(false); return }
    cardDebounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/card?q=${encodeURIComponent(value)}&candidates=true`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) { setDropdown(data); setShowDropdown(true) }
      }
    }, 500)
  }

  async function fetchSynergies(name: string) {
    setSynergyLoading(true)
    setSynergies([])
    const res = await fetch(`/api/synergy?card=${encodeURIComponent(name)}`)
    if (res.ok) {
      const data = await res.json()
      setSynergies(data.cards ?? [])
      setSynergyHeader(data.header ?? 'Synergies')
    }
    setSynergyLoading(false)
  }

  async function randomCard() {
    setLoading(true); setError(null); setCard(null); setCandidates([]); setSynergies([])
    const res = await fetch('/api/card?random=true')
    const data = await res.json()
    if (data.card) { setQuery(data.card.name); setCard(data.card); setCardStatus(data.status); fetchSynergies(data.card.name) }
    setLoading(false)
  }

  async function searchCard(q: string) {
    if (!q.trim()) return
    setLoading(true); setError(null); setCard(null); setCandidates([]); setCardStatus(null); setSynergies([])
    const res = await fetch(`/api/card?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Card not found') }
    else if (data.candidates) { setCandidates(data.candidates) }
    else { setCard(data.card); setCardStatus(data.status); fetchSynergies(data.card.name) }
    setLoading(false)
  }

  async function selectCandidate(name: string) {
    setLoading(true); setCandidates([]); setSynergies([])
    const res = await fetch(`/api/card?q=${encodeURIComponent(name)}`)
    const data = await res.json()
    if (data.card) { setCard(data.card); setCardStatus(data.status); fetchSynergies(data.card.name) }
    setLoading(false)
  }

  const image = card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal
  const oracle = card?.oracle_text ?? card?.card_faces?.map(f => `${f.name}\n${f.oracle_text ?? ''}`).join('\n\n')
  const anyBrewFilter = activeKeywords.length > 0 || activeColors.size > 0 || activeType !== null || maxCmc !== null || maxPrice !== null || brewRawQuery.trim() || oracleText.trim()

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-100">Card Search</h1>
        <div className="flex rounded-lg border-2 border-stone-700 overflow-hidden text-sm">
          <button
            onClick={() => setMode('card')}
            className={`px-4 py-2 transition-colors ${mode === 'card' ? 'bg-amber-950/70 text-amber-300 border-r-2 border-stone-700' : 'text-stone-500 hover:text-stone-300 border-r-2 border-stone-700'}`}
          >
            Card Name
          </button>
          <button
            onClick={() => setMode('brew')}
            className={`px-4 py-2 transition-colors ${mode === 'brew' ? 'bg-amber-950/70 text-amber-300' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Brew
          </button>
        </div>
      </div>

      {/* ── Card Name Mode ──────────────────────────────────── */}
      {mode === 'card' && (
        <div>
          <div className="relative flex gap-3 mb-8">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleCardInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchCard(query)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onFocus={() => dropdown.length > 0 && setShowDropdown(true)}
                placeholder="Search for a card..."
                className="w-full bg-stone-900 border-2 border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors"
              />
              {showDropdown && dropdown.length > 0 && (
                <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-stone-900 border-2 border-stone-700 rounded-xl overflow-hidden shadow-2xl">
                  {dropdown.map(c => (
                    <button
                      key={c.name}
                      onMouseDown={e => { e.preventDefault(); setShowDropdown(false); setQuery(c.name); selectCandidate(c.name) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800 transition-colors border-b border-stone-800 last:border-0 text-left"
                    >
                      <div>
                        <p className="text-stone-200 text-sm font-medium">{c.name}</p>
                        <p className="text-stone-500 text-xs">{c.type_line}</p>
                      </div>
                      {c.price && <span className="text-green-400 font-mono text-sm ml-4">${c.price}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => searchCard(query)} disabled={loading}
              className="px-6 py-3 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 text-amber-200 disabled:opacity-50 rounded-lg font-medium transition-colors">
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button onClick={randomCard} disabled={loading}
              className="px-4 py-3 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 rounded-lg font-medium text-stone-400 hover:text-stone-200 transition-colors" title="Random card">
              🎲
            </button>
          </div>

          {error && <div className="bg-red-900/30 border-2 border-red-700 rounded-lg px-4 py-3 text-red-300 mb-4">{error}</div>}

          {candidates.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-3">Multiple matches — pick one:</p>
              <div className="flex flex-col gap-2">
                {candidates.map(c => (
                  <button key={c.name} onClick={() => { setQuery(c.name); selectCandidate(c.name) }}
                    className="text-left px-4 py-3 bg-stone-900 border-2 border-stone-700 rounded-lg hover:border-amber-700/50 text-stone-200 text-sm transition-colors">
                    {c.name} <span className="text-stone-500 ml-2">{c.type_line}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {card && cardStatus && (
            <div className="flex gap-6 flex-col">
              <div className="flex flex-col sm:flex-row gap-6">
                {image && <img src={image} alt={card.name} className="w-full max-w-[224px] mx-auto sm:mx-0 sm:w-56 rounded-xl shadow-2xl flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3 flex-wrap">
                    <h2 className="text-xl font-bold text-stone-100">{card.name}</h2>
                    {card.mana_cost && <span className="text-stone-400 font-mono text-sm mt-1">{card.mana_cost}</span>}
                    <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLES[cardStatus]}`}>{STATUS_LABELS[cardStatus]}</span>
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
                    <p className="text-stone-400 text-sm mb-3">{card.power ? `P/T: ${card.power}/${card.toughness}` : `Loyalty: ${card.loyalty}`}</p>
                  )}
                  <div className="flex gap-6 text-sm">
                    {card.prices.usd && <div><span className="text-stone-500">Price</span><p className="text-green-400 font-mono font-medium">${card.prices.usd}</p></div>}
                    {card.prices.usd_foil && <div><span className="text-stone-500">Foil</span><p className="text-amber-500 font-mono font-medium">${card.prices.usd_foil}</p></div>}
                    <div><span className="text-stone-500">Set</span><p className="text-stone-300">{card.set_name}</p></div>
                  </div>
                </div>
              </div>

              {(synergyLoading || synergies.length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-stone-400 mb-3">
                    {synergyHeader || 'High Synergy Cards'}
                    <span className="text-stone-600 font-normal ml-2">via EDHREC</span>
                  </h3>
                  {synergyLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="aspect-[5/7] bg-stone-800 rounded-xl animate-pulse" />
                          <div className="h-3 bg-stone-800 rounded animate-pulse w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {synergies.map(s => (
                        <button key={s.name} onClick={() => { setQuery(s.name); searchCard(s.name) }}
                          className="group flex flex-col gap-1.5 text-left">
                          <div className="relative rounded-xl overflow-hidden shadow-lg">
                            {s.imageUrl
                              ? <img src={s.imageUrl} alt={s.name} className="w-full block group-hover:brightness-110 transition-all" />
                              : <div className="aspect-[5/7] bg-stone-800 rounded-xl" />}
                            {s.owned && (
                              <div className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm bg-green-900/80 text-green-300">Owned</div>
                            )}
                          </div>
                          <div className="px-0.5 flex flex-col gap-0.5">
                            <div className="flex items-baseline justify-between gap-1">
                              <p className="text-sm text-stone-200 font-semibold leading-tight">{s.name}</p>
                              <span className="text-xs font-bold text-amber-400 whitespace-nowrap">{Math.round(s.inclusionRate * 100)}% inclusion</span>
                            </div>
                            {s.typeLine && <p className="text-xs text-stone-500 leading-tight">{s.typeLine}</p>}
                            {s.rarity && (
                              <p className={`text-xs font-medium capitalize ${RARITY_COLOR[s.rarity] ?? 'text-stone-500'}`}>{s.rarity}</p>
                            )}
                            {s.price != null && <p className="text-sm font-mono text-stone-300">${s.price.toFixed(2)}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Brew Mode ──────────────────────────────────────── */}
      {mode === 'brew' && (
        <div className="flex gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Raw query input */}
            <div className="flex gap-3">
              <input
                value={displayedQuery}
                onChange={e => handleBrewRawInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runBrewFetch(displayedQuery, 1, false)}
                placeholder="Scryfall syntax or use filters"
                className="flex-1 bg-stone-900 border-2 border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors font-mono text-sm"
              />
              <button
                onClick={() => runBrewFetch(displayedQuery, 1, false)}
                disabled={brewLoading}
                className="px-6 py-3 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 text-amber-200 disabled:opacity-50 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                {brewLoading ? 'Searching…' : 'Search'}
              </button>
            </div>

            {/* Mobile accordion — hidden on desktop */}
            <div className="lg:hidden space-y-1">
              <AccordionRow title="Keywords" count={activeKeywords.length} open={keywordsOpen} onToggle={() => setKeywordsOpen(o => !o)}>
                <div className="space-y-3">
                  {KEYWORD_CATEGORIES.map(cat => (
                    <div key={cat}>
                      <p className="text-xs text-stone-400 uppercase tracking-widest mb-1.5">{cat}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {KEYWORDS.filter(k => k.category === cat).map(kw => (
                          <button key={kw.slug} onClick={() => toggleKeyword(kw.slug)}
                            className={`text-sm px-3 py-1.5 rounded-full border-2 transition-colors ${
                              activeKeywords.includes(kw.slug)
                                ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                                : 'bg-stone-800 border-stone-700 text-stone-300 active:border-amber-700/60 active:text-amber-400'
                            }`}>
                            {kw.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionRow>

              <div className="px-1 py-1">
                <p className="text-xs text-stone-500 uppercase tracking-widest mb-1.5">Oracle Text</p>
                <input
                  value={oracleText}
                  onChange={e => { setOracleText(e.target.value); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, e.target.value)) }}
                  placeholder='e.g. whenever you draw'
                  className="w-full bg-stone-800 border-2 border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
                />
              </div>

              <AccordionRow title="Colors" count={activeColors.size} open={colorsOpen} onToggle={() => setColorsOpen(o => !o)}>
                <div className="flex gap-2.5">
                  {COLOR_CHIPS.map(c => (
                    <button key={c.symbol} onClick={() => toggleColor(c.symbol)} title={c.label}
                      className={`w-9 h-9 rounded-full text-sm font-bold border-2 transition-all ${
                        activeColors.has(c.symbol)
                          ? `${c.activeBg} ${c.text} ${c.border} scale-110 shadow-md`
                          : `${c.bg} ${c.text} border-transparent opacity-40`
                      }`}>
                      {c.symbol}
                    </button>
                  ))}
                </div>
              </AccordionRow>

              <AccordionRow title="Type" count={activeType ? 1 : 0} open={typeOpen} onToggle={() => setTypeOpen(o => !o)}>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_TYPES.map(t => (
                    <button key={t} onClick={() => selectType(t.toLowerCase())}
                      className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                        activeType === t.toLowerCase()
                          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 active:border-amber-700/60 active:text-amber-400'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </AccordionRow>

              <AccordionRow title="CMC" count={maxCmc !== null ? 1 : 0} open={cmcOpen} onToggle={() => setCmcOpen(o => !o)}>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCmcFilter(null)}
                    className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                      maxCmc === null
                        ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400'
                    }`}>
                    Any
                  </button>
                  {CMC_PRESETS.map(n => (
                    <button key={n} onClick={() => setCmcFilter(maxCmc === n ? null : n)}
                      className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                        maxCmc === n
                          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400'
                      }`}>
                      ≤{n}
                    </button>
                  ))}
                </div>
              </AccordionRow>

              <AccordionRow title="Price" count={maxPrice !== null ? 1 : 0} open={priceOpen} onToggle={() => setPriceOpen(o => !o)}>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={1} max={MAX_PRICE_SLIDER} step={1}
                    value={priceSlider}
                    onChange={e => handlePriceSlider(Number(e.target.value))}
                    className="flex-1 accent-amber-600 cursor-pointer"
                  />
                  <span className={`text-xs font-mono w-14 ${maxPrice !== null ? 'text-amber-400' : 'text-stone-600'}`}>
                    {maxPrice !== null ? `≤ $${maxPrice}` : 'Any'}
                  </span>
                </div>
              </AccordionRow>

              <div className="flex justify-end pt-0.5">
                <button
                  onClick={clearAllFilters}
                  disabled={!anyBrewFilter}
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-stone-700 text-stone-400 hover:border-red-800/60 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Desktop filter panel — hidden on mobile */}
            <div className="hidden lg:block bg-stone-900/50 border-2 border-stone-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-500 uppercase tracking-widest">Filters</p>
                <button
                  onClick={clearAllFilters}
                  disabled={!anyBrewFilter}
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-stone-700 text-stone-400 hover:border-red-800/60 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0">Color</span>
                  <div className="flex gap-1.5">
                    {COLOR_CHIPS.map(c => (
                      <button key={c.symbol} onClick={() => toggleColor(c.symbol)} title={c.label}
                        className={`w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${
                          activeColors.has(c.symbol)
                            ? `${c.activeBg} ${c.text} ${c.border} scale-110 shadow-md`
                            : `${c.bg} ${c.text} border-transparent opacity-40 hover:opacity-70`
                        }`}>
                        {c.symbol}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-stone-400 shrink-0">Type</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CARD_TYPES.map(t => (
                      <button key={t} onClick={() => selectType(t.toLowerCase())}
                        className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                          activeType === t.toLowerCase()
                            ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0">CMC</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setCmcFilter(null)}
                      className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                        maxCmc === null
                          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                      }`}>
                      Any
                    </button>
                    {CMC_PRESETS.map(n => (
                      <button key={n} onClick={() => setCmcFilter(maxCmc === n ? null : n)}
                        className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                          maxCmc === n
                            ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                        }`}>
                        ≤{n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 shrink-0">Max Price</span>
                  <input
                    type="range" min={1} max={MAX_PRICE_SLIDER} step={1}
                    value={priceSlider}
                    onChange={e => handlePriceSlider(Number(e.target.value))}
                    className="w-28 accent-amber-600 cursor-pointer"
                  />
                  <span className={`text-xs font-mono w-14 ${maxPrice !== null ? 'text-amber-400' : 'text-stone-600'}`}>
                    {maxPrice !== null ? `≤ $${maxPrice}` : 'Any'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-400 shrink-0">Oracle Text</span>
                <input
                  value={oracleText}
                  onChange={e => { setOracleText(e.target.value); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, e.target.value)) }}
                  placeholder='e.g. whenever you draw'
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
                />
              </div>
            </div>

            {/* Active filters strip */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-600">Active:</span>
                {activeFilters.map(f => (
                  <button key={f.label} onClick={f.onRemove}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-900/40 border-2 border-amber-700/60 text-amber-300 hover:bg-amber-900/70 transition-colors">
                    {f.label} <span className="text-amber-500 ml-0.5">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {brewError && (
              <div className="bg-red-900/30 border-2 border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{brewError}</div>
            )}

            {/* Empty state */}
            {!brewLoading && allFetchedCards.length === 0 && !brewError && !anyBrewFilter && (
              <div className="text-center py-16 text-stone-600">
                <p className="text-3xl mb-3">🍺</p>
                <p className="text-sm">Click keywords or type a query to start brewing.</p>
              </div>
            )}

            {/* Results header + pagination controls */}
            {(brewLoading || allFetchedCards.length > 0) && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-stone-600">
                  {brewLoading && allFetchedCards.length === 0
                    ? 'Searching…'
                    : `${brewTotal.toLocaleString()} results · page ${clientPage} of ${totalClientPages}${hasMoreScryfall ? '+' : ''}`}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={goPrevPage} disabled={clientPage <= 1}
                    className="text-xs px-3 py-1 rounded-lg bg-stone-800 border-2 border-stone-700 text-stone-400 hover:text-stone-200 disabled:opacity-30 transition-colors">
                    ← Prev
                  </button>
                  <button onClick={goNextPage} disabled={!hasNextPage || brewLoading}
                    className="text-xs px-3 py-1 rounded-lg bg-stone-800 border-2 border-stone-700 text-stone-400 hover:text-stone-200 disabled:opacity-30 transition-colors">
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Results grid */}
            {brewLoading && allFetchedCards.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="aspect-[5/7] bg-stone-800 rounded-xl animate-pulse" />
                    <div className="h-3 bg-stone-800 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-stone-800 rounded animate-pulse w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {visibleCards.map(c => (
                  <BrewResultCard
                    key={c.name}
                    card={c}
                    onAddToWishlist={() => addToWishlist(c.name)}
                    isAdding={wishlistLoading.has(c.name)}
                    isAdded={wishlistAdded.has(c.name)}
                  />
                ))}
              </div>
            )}

          </div>

          {/* Desktop legend sidebar */}
          <div className="hidden lg:block w-52 shrink-0">
            <p className="text-xs text-stone-500 uppercase tracking-widest mb-4">Keywords</p>
            <KeywordLegend onInsert={toggleKeyword} activeKeywords={activeKeywords} />
          </div>
        </div>
      )}
    </div>
  )
}
