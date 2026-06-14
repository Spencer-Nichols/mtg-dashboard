'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { KEYWORDS, KEYWORD_CATEGORIES } from '@/lib/keywords'
import { RECENT_SETS } from '@/lib/sets'
import type { BrewCard } from '@/app/api/search/brew/route'

interface PrintingOption {
  scryfallId?: string
  name: string
  setCode: string
  setName: string
  price: number | null
  imageUrl?: string | null
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
  uncommon: 'text-blue-400', common: 'text-stone-400',
}

const ART_TYPES = [
  { label: 'Showcase', value: 'is:showcase' },
  { label: 'Extended Art', value: 'is:extendedart' },
  { label: 'Borderless', value: 'is:borderless' },
  { label: 'Full Art', value: 'is:fullart' },
  { label: 'Poster', value: 'is:poster' },
  { label: 'Textless', value: 'is:textless' },
  { label: 'Inverted', value: 'is:inverted' },
  { label: 'Secret Lair Promo', value: 'set:slp' },
]

function buildBrewQuery(
  keywords: string[], colors: Set<string>, activeType: string | null,
  maxCmc: number | null, maxPrice: number | null, raw: string,
  oracleText?: string,
  artTypes?: Set<string>,
  setCodes?: string[] | null,
  colorMode?: 'exact' | 'includes',
): string {
  const parts: string[] = []
  for (const slug of keywords) parts.push(`function:${slug}`)
  if (raw.trim()) parts.push(raw.trim())
  if (oracleText?.trim()) parts.push(`o:"${oracleText.trim()}"`)
  if (colors.size > 0) {
    if (colorMode === 'includes' && colors.size > 1) {
      parts.push(`(${[...colors].map(c => `color>=${c}`).join(' or ')})`)
    } else {
      parts.push(`color${colorMode === 'includes' ? '>=' : '='}${[...colors].join('')}`)
    }
  }
  if (activeType) parts.push(`t:${activeType}`)
  if (maxCmc !== null) parts.push(`cmc<=${maxCmc}`)
  if (maxPrice !== null) parts.push(`usd<=${maxPrice}`)
  if (artTypes) for (const a of artTypes) parts.push(a)
  if (setCodes && setCodes.length > 0) {
    parts.push(setCodes.length === 1 ? `e:${setCodes[0]}` : `(${setCodes.map(c => `e:${c}`).join(' or ')})`)
  }
  return parts.join(' ')
}

function KeywordLegend({ onInsert, activeKeywords }: {
  onInsert: (slug: string) => void
  activeKeywords: string[]
}) {
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())

  function toggleCat(cat: string) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {KEYWORD_CATEGORIES.map(cat => {
        const catKws = KEYWORDS.filter(k => k.category === cat)
        const activeCount = catKws.filter(k => activeKeywords.includes(k.slug)).length
        const isOpen = openCats.has(cat)
        return (
          <div key={cat} className="border border-stone-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCat(cat)}
              className="w-full flex items-center justify-between px-3 py-2 bg-stone-900/50 text-xs text-stone-400 hover:text-stone-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {cat}
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300">{activeCount}</span>
                )}
              </span>
              <span className="text-stone-600 text-lg">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="px-3 py-2.5 bg-stone-900/30 border-t border-stone-800 flex flex-wrap gap-1.5">
                {catKws.map(kw => (
                  <button
                    key={kw.slug}
                    onClick={() => onInsert(kw.slug)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      activeKeywords.includes(kw.slug)
                        ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                    }`}
                  >
                    {kw.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs text-stone-600 pt-1 px-1">Combine multiple to narrow results.</p>
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
      <div className={`relative rounded-xl overflow-hidden shadow-lg transition-all ${card.owned ? 'ring-[3px] ring-offset-2 ring-offset-stone-950 ring-green-600/60' : isOnWishlist ? 'ring-[3px] ring-offset-2 ring-offset-stone-950 ring-amber-600/60' : ''}`}>
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
        {card.typeLine && <p className="text-xs text-stone-400 leading-tight">{card.typeLine}</p>}
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-medium capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-400'}`}>{card.rarity}</p>
          {card.price != null && <p className="text-sm font-mono text-stone-400">${card.price.toFixed(2)}</p>}
        </div>
      </div>
    </div>
  )
}

function PrintingsModal({ name, onClose, onSelect }: {
  name: string
  onClose: () => void
  onSelect: (scryfallId: string | undefined, name: string) => void
}) {
  const [printings, setPrintings] = useState<PrintingOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/card?q=${encodeURIComponent(name)}&prints=true`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setPrintings(data) })
      .finally(() => setLoading(false))
  }, [name])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <div>
            <p className="font-semibold text-stone-100">{name}</p>
            <p className="text-xs text-stone-500">Select a printing to add to wishlist</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <p className="text-sm text-stone-600">Loading printings…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {printings.map(p => (
                <button
                  key={p.scryfallId ?? p.setCode}
                  onClick={() => onSelect(p.scryfallId, p.name)}
                  className="flex flex-col w-full rounded-xl border border-stone-700 hover:border-amber-600 transition-colors overflow-hidden text-left"
                >
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full" />
                    : <div className="aspect-[63/88] bg-stone-800 flex items-center justify-center text-stone-600 text-xs p-2">{p.name}</div>}
                  <div className="px-2 py-1.5 bg-stone-800 w-full">
                    <p className="text-xs text-stone-300 font-medium">{p.setName}</p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-stone-600 font-mono">{p.setCode.toUpperCase()}</span>
                      <span className="text-xs font-mono text-stone-400">{p.price != null ? `$${p.price.toFixed(2)}` : '—'}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
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
        <span className="text-stone-600 text-lg">{open ? '▾' : '▸'}</span>
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
  // ── Brew state ────────────────────────────────────────────
  const [brewRawQuery, setBrewRawQuery] = useState('')
  const [displayedQuery, setDisplayedQuery] = useState('')
  const [oracleText, setOracleText] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<string[]>([])
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [colorMode, setColorMode] = useState<'exact' | 'includes'>('exact')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [maxCmc, setMaxCmc] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [priceSlider, setPriceSlider] = useState(MAX_PRICE_SLIDER)
  const [keywordsOpen, setKeywordsOpen] = useState(false)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [cmcOpen, setCmcOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [activeArtTypes, setActiveArtTypes] = useState<Set<string>>(new Set())
  const [activeSet, setActiveSet] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [artOpen, setArtOpen] = useState(false)
  const [setsOpen, setSetsOpen] = useState(false)
  const recentSets = RECENT_SETS
  const getSetCodes = (name: string | null): string[] | null =>
    name ? (RECENT_SETS.find(s => s.name === name)?.codes ?? null) : null

  const [allFetchedCards, setAllFetchedCards] = useState<BrewCard[]>([])
  const [clientPage, setClientPage] = useState(1)
  const [scryfallPage, setScryfallPage] = useState(1)
  const [hasMoreScryfall, setHasMoreScryfall] = useState(false)
  const [brewTotal, setBrewTotal] = useState(0)
  const [brewLoading, setBrewLoading] = useState(false)
  const [brewError, setBrewError] = useState<string | null>(null)

  const [sortOwnedFirst, setSortOwnedFirst] = useState(true)

  const [wishlistAdded, setWishlistAdded] = useState<Set<string>>(new Set())
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set())
  const [printingsModal, setPrintingsModal] = useState<string | null>(null)

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
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'search' }) })
  }, [])

  useEffect(() => {
    const filterPart = buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, '', oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)
    const raw = brewRawQueryRef.current
    setDisplayedQuery(
      filterPart
        ? raw.trim() ? `${filterPart} ${raw.trim()}` : filterPart
        : raw
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeywords, activeColors, activeType, maxCmc, maxPrice, oracleText, activeArtTypes, activeSet])

  // ── Brew filter handlers ──────────────────────────────────

  function toggleKeyword(slug: string) {
    const next = activeKeywords.includes(slug)
      ? activeKeywords.filter(k => k !== slug)
      : [...activeKeywords, slug]
    setActiveKeywords(next)
    scheduleFetch(buildBrewQuery(next, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode))
  }

  function toggleColor(symbol: string) {
    const next = new Set(activeColors)
    next.has(symbol) ? next.delete(symbol) : next.add(symbol)
    setActiveColors(next)
    scheduleFetch(buildBrewQuery(activeKeywords, next, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode))
  }

  function selectType(type: string) {
    const next = activeType === type ? null : type
    setActiveType(next)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, next, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode))
  }

  function setCmcFilter(val: number | null) {
    setMaxCmc(val)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, val, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode))
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
      runBrewFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, price, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode), 1, false)
    }, 500)
  }

  function handleBrewRawInput(val: string) {
    const filterPart = buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, '', oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)
    const extraTerms = filterPart && val.startsWith(filterPart)
      ? val.slice(filterPart.length).trimStart()
      : val
    setBrewRawQuery(extraTerms)
    setDisplayedQuery(val)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, extraTerms, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode))
  }

  function toggleArtType(value: string) {
    const next = new Set(activeArtTypes)
    next.has(value) ? next.delete(value) : next.add(value)
    setActiveArtTypes(next)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, next, getSetCodes(activeSet), colorMode))
  }

  function selectSet(name: string) {
    const next = activeSet === name ? null : name
    setActiveSet(next)
    scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(next)))
  }

  function clearAllFilters() {
    setActiveKeywords([])
    setActiveColors(new Set())
    setColorMode('exact')
    setActiveType(null)
    setMaxCmc(null)
    setMaxPrice(null)
    setPriceSlider(MAX_PRICE_SLIDER)
    setBrewRawQuery('')
    setDisplayedQuery('')
    setOracleText('')
    setActiveArtTypes(new Set())
    setActiveSet(null)
    setAllFetchedCards([])
    setBrewTotal(0)
    setHasMoreScryfall(false)
    setClientPage(1)
    setScryfallPage(1)
    setBrewError(null)
  }

  // ── Pagination ────────────────────────────────────────────

  const sortedCards = sortOwnedFirst
    ? [...allFetchedCards].sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0))
    : allFetchedCards
  const visibleCards = sortedCards.slice((clientPage - 1) * CLIENT_PAGE_SIZE, clientPage * CLIENT_PAGE_SIZE)
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

  async function addToWishlist(name: string, scryfallId: string) {
    setWishlistLoading(prev => new Set(prev).add(name))
    const res = await fetch('/api/wishlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scryfallId }),
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
    ...(oracleText.trim() ? [{ label: `o: "${oracleText.trim()}"`, onRemove: () => { setOracleText(''); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)) } }] : []),
    ...[...activeArtTypes].map(v => ({
      label: ART_TYPES.find(a => a.value === v)?.label ?? v,
      onRemove: () => toggleArtType(v),
    })),
    ...(activeSet ? [{ label: activeSet, onRemove: () => selectSet(activeSet) }] : []),
  ]

  // ── Card search handlers ──────────────────────────────────

  const anyBrewFilter = activeKeywords.length > 0 || activeColors.size > 0 || activeType !== null || maxCmc !== null || maxPrice !== null || brewRawQuery.trim() || oracleText.trim() || activeArtTypes.size > 0 || activeSet !== null

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-100 mb-6">Card Search</h1>

      {printingsModal && (
        <PrintingsModal
          name={printingsModal}
          onClose={() => setPrintingsModal(null)}
          onSelect={(scryfallId, name) => {
            setPrintingsModal(null)
            addToWishlist(name, scryfallId ?? '')
          }}
        />
      )}

      {/* ── Brew ──────────────────────────────────────── */}
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
                className="flex-1 bg-stone-900 border-2 border-stone-700 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors font-mono text-base sm:text-sm"
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
              <div className="px-1 py-1">
                <p className="text-xs text-stone-400 uppercase tracking-widest mb-1.5">Oracle Text</p>
                <input
                  value={oracleText}
                  onChange={e => { setOracleText(e.target.value); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)) }}
                  placeholder='e.g. whenever you draw'
                  className="w-full bg-stone-800 border-2 border-stone-700 rounded-lg px-3 py-2 text-base sm:text-sm text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors"
                />
              </div>
              <AccordionRow title="Keywords" count={activeKeywords.length} open={keywordsOpen} onToggle={() => setKeywordsOpen(o => !o)}>
                <KeywordLegend onInsert={toggleKeyword} activeKeywords={activeKeywords} />
              </AccordionRow>

              <AccordionRow title="Colors" count={activeColors.size} open={colorsOpen} onToggle={() => setColorsOpen(o => !o)}>
                <div className="flex items-center gap-2.5 flex-wrap justify-center">
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
                  {activeColors.size > 0 && (
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className={`text-xs transition-colors ${colorMode === 'exact' ? 'text-amber-300' : 'text-stone-500'}`}>Exact</span>
                      <button
                        role="switch"
                        aria-checked={colorMode === 'includes'}
                        onClick={() => { const next = colorMode === 'exact' ? 'includes' : 'exact'; setColorMode(next); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), next)) }}
                        className={`relative w-9 h-5 rounded-full border transition-colors ${colorMode === 'includes' ? 'bg-amber-900/80 border-amber-600' : 'bg-stone-700 border-stone-600'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${colorMode === 'includes' ? 'left-[18px] bg-amber-400' : 'left-0.5 bg-stone-400'}`} />
                      </button>
                      <span className={`text-xs transition-colors ${colorMode === 'includes' ? 'text-amber-300' : 'text-stone-500'}`}>Includes</span>
                    </div>
                  )}
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

              <AccordionRow title="Art Style" count={activeArtTypes.size} open={artOpen} onToggle={() => setArtOpen(o => !o)}>
                <div className="flex flex-wrap gap-1.5">
                  {ART_TYPES.map(a => (
                    <button key={a.value} onClick={() => toggleArtType(a.value)}
                      className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                        activeArtTypes.has(a.value)
                          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 active:border-amber-700/60 active:text-amber-400'
                      }`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </AccordionRow>

              {recentSets.length > 0 && (
                <AccordionRow title="Recent Sets" count={activeSet ? 1 : 0} open={setsOpen} onToggle={() => setSetsOpen(o => !o)}>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSets.map(s => (
                      <button key={s.name} onClick={() => selectSet(s.name)}
                        className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                          activeSet === s.name
                            ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                            : 'bg-stone-800 border-stone-700 text-stone-400 active:border-amber-700/60 active:text-amber-400'
                        }`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </AccordionRow>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <button
                  onClick={() => setSortOwnedFirst(o => !o)}
                  className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                    sortOwnedFirst
                      ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 active:border-amber-700/60 active:text-amber-400'
                  }`}
                >
                  Owned first
                </button>
                <button
                  onClick={clearAllFilters}
                  disabled={!anyBrewFilter}
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-stone-700 text-stone-400 hover:border-red-800/60 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Desktop filter panel — collapsible */}
            <div className="hidden lg:block border-2 border-stone-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-900/50 text-sm text-stone-400 hover:text-stone-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  Filters
                  {activeFilters.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300">
                      {activeFilters.length}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {anyBrewFilter && (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); clearAllFilters() }}
                      className="text-xs text-stone-500 hover:text-red-400 transition-colors"
                    >
                      Clear All
                    </span>
                  )}
                  <span className="text-stone-600 text-lg">{filtersOpen ? '▾' : '▸'}</span>
                </div>
              </button>
              {filtersOpen && (
              <div className="px-4 py-3 bg-stone-900/30 border-t-2 border-stone-800 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 shrink-0">Oracle Text</span>
                  <input
                    value={oracleText}
                    onChange={e => { setOracleText(e.target.value); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)) }}
                    placeholder='e.g. whenever you draw'
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-base sm:text-sm text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors"
                  />
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
                    {activeColors.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs transition-colors ${colorMode === 'exact' ? 'text-amber-300' : 'text-stone-500'}`}>Exact</span>
                        <button
                          role="switch"
                          aria-checked={colorMode === 'includes'}
                          onClick={() => { const next = colorMode === 'exact' ? 'includes' : 'exact'; setColorMode(next); scheduleFetch(buildBrewQuery(activeKeywords, activeColors, activeType, maxCmc, maxPrice, brewRawQuery, oracleText, activeArtTypes, getSetCodes(activeSet), next)) }}
                          className={`relative w-9 h-5 rounded-full border transition-colors ${colorMode === 'includes' ? 'bg-amber-900/80 border-amber-600' : 'bg-stone-700 border-stone-600'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${colorMode === 'includes' ? 'left-[18px] bg-amber-400' : 'left-0.5 bg-stone-400'}`} />
                        </button>
                        <span className={`text-xs transition-colors ${colorMode === 'includes' ? 'text-amber-300' : 'text-stone-500'}`}>Includes</span>
                      </div>
                    )}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-stone-400 shrink-0">Art Style</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ART_TYPES.map(a => (
                      <button key={a.value} onClick={() => toggleArtType(a.value)}
                        className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                          activeArtTypes.has(a.value)
                            ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                        }`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                {recentSets.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-stone-400 shrink-0">Recent Sets</span>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSets.map(s => (
                        <button key={s.name} onClick={() => selectSet(s.name)}
                          className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                            activeSet === s.name
                              ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                              : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                          }`}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0">Sort</span>
                  <button
                    onClick={() => setSortOwnedFirst(o => !o)}
                    className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
                      sortOwnedFirst
                        ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                    }`}
                  >
                    Owned first
                  </button>
                </div>
              </div>
              )}
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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-stone-600">
                    {brewLoading && allFetchedCards.length === 0
                      ? 'Searching…'
                      : `${brewTotal.toLocaleString()} results · page ${clientPage} of ${totalClientPages}${hasMoreScryfall ? '+' : ''}`}
                  </p>
                </div>
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
                    onAddToWishlist={() => activeArtTypes.size > 0 ? addToWishlist(c.name, c.id) : setPrintingsModal(c.name)}
                    isAdding={wishlistLoading.has(c.name)}
                    isAdded={wishlistAdded.has(c.name)}
                  />
                ))}
              </div>
            )}

            {/* Bottom pagination */}
            {!brewLoading && allFetchedCards.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-stone-600">
                  {`${brewTotal.toLocaleString()} results · page ${clientPage} of ${totalClientPages}${hasMoreScryfall ? '+' : ''}`}
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

          </div>

          {/* Desktop keyword sidebar */}
          <div className="hidden lg:block w-52 shrink-0">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-3">Keywords</p>
            <KeywordLegend onInsert={toggleKeyword} activeKeywords={activeKeywords} />
          </div>

        </div>
    </div>
  )
}
