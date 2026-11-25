'use client'

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode, type KeyboardEvent } from 'react'
import { KEYWORDS } from '@/lib/keywords'
import { ROLES, childTags, formatTag, loadTags, matchKeywords, matchTags, relatedKeywords } from '@/lib/tag-search'
import { TagBrowser } from '@/components/search/TagBrowser'
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
const PRICE_PRESETS = [1, 5, 10]
const SUGGESTION_LIMIT = 8
const NARROW_PREVIEW = 12
const CLIENT_PAGE_SIZE = 24

const RARITY_COLOR: Record<string, string> = {
  mythic: 'text-orange-400', rare: 'text-yellow-400',
  uncommon: 'text-blue-400', common: 'text-stone-400',
}

const SORT_OPTIONS = [
  { value: 'edhrec-desc', label: 'Sort: Popular (EDHREC)' },
  { value: 'usd-desc', label: 'Price: high to low' },
  { value: 'usd-asc', label: 'Price: low to high' },
  { value: 'rarity-desc', label: 'Rarity: high to low' },
  { value: 'rarity-asc', label: 'Rarity: low to high' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border-2 transition-colors ${
        active
          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400 active:border-amber-700/60 active:text-amber-400'
      }`}>
      {children}
    </button>
  )
}

const RARITY_RANK: Record<string, number> = { mythic: 4, rare: 3, uncommon: 2, common: 1 }

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

const KEYWORD_QUERY_MAP = new Map(KEYWORDS.map(k => [k.slug, k.query ?? `function:${k.slug}`]))

function buildBrewQuery(
  keywords: string[], tags: string[], colors: Set<string>, activeType: string | null,
  maxCmc: number | null, maxPrice: number | null, raw: string,
  oracleText?: string,
  artTypes?: Set<string>,
  setCodes?: string[] | null,
  colorMode?: 'exact' | 'includes' | 'commander',
): string {
  const parts: string[] = []
  for (const slug of keywords) parts.push(KEYWORD_QUERY_MAP.get(slug) ?? `function:${slug}`)
  for (const tag of tags) parts.push(`otag:${tag}`)
  if (raw.trim()) parts.push(raw.trim())
  if (oracleText?.trim()) parts.push(`o:"${oracleText.trim().replace(/"/g, '')}"`)
  if (colors.size > 0) {
    if (colorMode === 'commander') {
      parts.push(`id<=${[...colors].join('')}`)
    } else if (colorMode === 'includes' && colors.size > 1) {
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

function BrewResultCard({ card, onAddToWishlist, isAdding, isAdded, onPreview }: {
  card: BrewCard
  onAddToWishlist: () => void
  isAdding: boolean
  isAdded: boolean
  onPreview: () => void
}) {
  const isOnWishlist = card.onWishlist || isAdded
  return (
    <div className="flex flex-col gap-1.5 group relative lg:hover:z-50">
      <div
        onClick={onPreview}
        className={`relative rounded-xl shadow-lg transition-transform duration-200 origin-bottom lg:group-hover:scale-150 lg:group-hover:ring-2 lg:group-hover:ring-amber-500/70 cursor-pointer ${card.owned ? 'ring-[3px] ring-offset-2 ring-offset-stone-950 ring-green-600/60' : isOnWishlist ? 'ring-[3px] ring-offset-2 ring-offset-stone-950 ring-amber-600/60' : ''}`}
      >
        {card.imageUrl
          ? <img src={card.imageUrl} alt={card.name} className="w-full block rounded-xl" />
          : <div className="aspect-[5/7] bg-stone-800 rounded-xl flex items-center justify-center text-stone-600 text-xs p-2 text-center">{card.name}</div>}

        {isAdding && (
          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center">
            <p className="text-xs text-amber-400">Adding…</p>
          </div>
        )}
      </div>

      <div className="px-0.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.owned && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/80 text-green-300 shrink-0">Owned</span>
          )}
          {!card.owned && isOnWishlist && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/80 text-amber-300 shrink-0">{isAdded ? '✓ Added' : 'Wishlist'}</span>
          )}
          <p className="text-sm text-stone-200 font-semibold leading-tight truncate min-w-0">{card.name}</p>
        </div>
        {card.typeLine && <p className="text-xs text-stone-400 leading-tight">{card.typeLine}</p>}
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-medium capitalize ${RARITY_COLOR[card.rarity] ?? 'text-stone-400'}`}>{card.rarity}</p>
          <div className="flex items-center gap-2 shrink-0">
            {card.price != null && <p className="text-sm font-mono text-stone-400">${card.price.toFixed(2)}</p>}
            {!card.owned && !isOnWishlist && !isAdding && (
              <button
                onClick={e => { e.stopPropagation(); onAddToWishlist() }}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-950/60 border-2 border-amber-700 text-amber-400 hover:bg-amber-700 hover:text-stone-950 hover:border-amber-600 transition-colors"
              >
                + Wishlist
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CardPreviewModal({ card, onClose, onAddToWishlist, isAdding }: {
  card: BrewCard
  onClose: () => void
  onAddToWishlist: () => void
  isAdding: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex flex-col items-center gap-3 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-stone-900 border border-stone-700 text-stone-400 hover:text-stone-100 hover:border-stone-500 flex items-center justify-center text-lg leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>
        {card.imageUrl
          ? <img src={card.imageUrl} alt={card.name} className="w-full rounded-xl shadow-2xl cursor-pointer" onClick={onClose} />
          : <div className="aspect-[5/7] w-full bg-stone-800 rounded-xl flex items-center justify-center text-stone-600 text-sm p-4 text-center cursor-pointer" onClick={onClose}>{card.name}</div>}
        <div className="w-full flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-sm text-stone-200 font-semibold">{card.name}</p>
            {card.typeLine && <p className="text-xs text-stone-500">{card.typeLine}</p>}
          </div>
          {card.price != null && <p className="text-sm font-mono text-stone-400 shrink-0">${card.price.toFixed(2)}</p>}
        </div>
        {card.owned ? (
          <p className="text-sm font-bold text-green-300">Owned</p>
        ) : card.onWishlist ? (
          <p className="text-sm font-bold text-amber-300">On Wishlist</p>
        ) : (
          <button
            onClick={() => { onAddToWishlist(); onClose() }}
            disabled={isAdding}
            className="w-full text-sm px-4 py-2.5 rounded-lg bg-amber-950/60 border-2 border-amber-700 text-amber-400 hover:bg-amber-700 hover:text-stone-950 hover:border-amber-600 transition-colors disabled:opacity-50"
          >
            {isAdding ? 'Adding…' : '+ Add to Wishlist'}
          </button>
        )}
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
  const [oracleText, setOracleText] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<string[]>([])
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[] | null>(null)
  const [barFocused, setBarFocused] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [narrowTag, setNarrowTag] = useState<string | null>(null)
  const [showAllNarrow, setShowAllNarrow] = useState(false)
  const [showQuery, setShowQuery] = useState(false)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [colorMode, setColorMode] = useState<'exact' | 'includes' | 'commander'>('exact')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [maxCmc, setMaxCmc] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [colorsOpen, setColorsOpen] = useState(false)
  const [typeCmcOpen, setTypeCmcOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [oracleOpen, setOracleOpen] = useState(false)
  const [activeArtTypes, setActiveArtTypes] = useState<Set<string>>(new Set())
  const [activeSet, setActiveSet] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [printingOpen, setPrintingOpen] = useState(false)
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
  const [sortBy, setSortBy] = useState<'edhrec' | 'rarity' | 'usd' | 'name'>('edhrec')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [wishlistAdded, setWishlistAdded] = useState<Set<string>>(new Set())
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set())
  const [printingsModal, setPrintingsModal] = useState<string | null>(null)
  const [previewCard, setPreviewCard] = useState<BrewCard | null>(null)

  const brewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Brew core fetch ───────────────────────────────────────

  const runBrewFetch = useCallback(async (q: string, page: number, append: boolean, owned: boolean) => {
    if (!q.trim()) {
      setAllFetchedCards([])
      setBrewTotal(0)
      setHasMoreScryfall(false)
      return
    }
    setBrewLoading(true)
    setBrewError(null)
    const res = await fetch(`/api/search/brew?q=${encodeURIComponent(q)}&page=${page}${owned ? '&owned=true' : ''}`)
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

  useEffect(() => {
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'search' }) })
  }, [])

  const filterQuery = buildBrewQuery(activeKeywords, activeTags, activeColors, activeType, maxCmc, maxPrice, '', oracleText, activeArtTypes, getSetCodes(activeSet), colorMode)
  const fullQuery = [filterQuery, brewRawQuery.trim()].filter(Boolean).join(' ')

  useEffect(() => {
    if (brewDebounceRef.current) clearTimeout(brewDebounceRef.current)
    brewDebounceRef.current = setTimeout(() => {
      setClientPage(1)
      runBrewFetch(fullQuery, 1, false, ownedOnly)
    }, 700)
  }, [fullQuery, ownedOnly, runBrewFetch])

  // ── Brew filter handlers ──────────────────────────────────

  function toggleKeyword(slug: string) {
    setActiveKeywords(prev => prev.includes(slug) ? prev.filter(k => k !== slug) : [...prev, slug])
  }

  function toggleColor(symbol: string) {
    setActiveColors(prev => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  function selectType(type: string) {
    setActiveType(prev => prev === type ? null : type)
  }

  function setCmcFilter(val: number | null) {
    setMaxCmc(val)
  }


  function toggleArtType(value: string) {
    setActiveArtTypes(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function selectSet(name: string) {
    setActiveSet(prev => prev === name ? null : name)
  }

  function clearAllFilters() {
    setActiveKeywords([])
    setActiveTags([])
    setNarrowTag(null)
    setOwnedOnly(false)
    setActiveColors(new Set())
    setColorMode('exact')
    setActiveType(null)
    setMaxCmc(null)
    setMaxPrice(null)
    setBrewRawQuery('')
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

  const sortedCards = [...allFetchedCards].sort((a, b) => {
    if (sortOwnedFirst) {
      const ownedCmp = (b.owned ? 1 : 0) - (a.owned ? 1 : 0)
      if (ownedCmp !== 0) return ownedCmp
    }
    let cmp = 0
    if (sortBy === 'rarity') cmp = (RARITY_RANK[a.rarity] ?? 0) - (RARITY_RANK[b.rarity] ?? 0)
    else if (sortBy === 'usd') cmp = (a.price ?? 0) - (b.price ?? 0)
    else if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    return sortDir === 'desc' ? -cmp : cmp
  })
  const visibleCards = sortedCards.slice((clientPage - 1) * CLIENT_PAGE_SIZE, clientPage * CLIENT_PAGE_SIZE)
  const totalClientPages = Math.max(1, Math.ceil(allFetchedCards.length / CLIENT_PAGE_SIZE))
  const hasNextPage = clientPage < totalClientPages || hasMoreScryfall

  async function goNextPage() {
    const nextPage = clientPage + 1
    if ((nextPage - 1) * CLIENT_PAGE_SIZE < allFetchedCards.length) {
      setClientPage(nextPage)
    } else if (hasMoreScryfall && !brewLoading) {
      await runBrewFetch(fullQuery, scryfallPage + 1, true, ownedOnly)
      setClientPage(nextPage)
    }
    document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function goPrevPage() {
    if (clientPage > 1) {
      setClientPage(p => p - 1)
      document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const activeFilters: { key: string; label: string; onRemove: () => void; tag?: string }[] = [
    ...activeTags.map(tag => ({ key: `tag:${tag}`, label: formatTag(tag), tag, onRemove: () => { removeTag(tag); if (narrowTag === tag) setNarrowTag(null) } })),
    ...activeKeywords.map(slug => ({
      key: `kw:${slug}`,
      label: KEYWORDS.find(k => k.slug === slug)?.label ?? slug,
      onRemove: () => toggleKeyword(slug),
    })),
    ...[...activeColors].map(c => ({ key: `color:${c}`, label: c, onRemove: () => toggleColor(c) })),
    ...(activeType ? [{ key: 'type', label: activeType.charAt(0).toUpperCase() + activeType.slice(1), onRemove: () => selectType(activeType) }] : []),
    ...(maxCmc !== null ? [{ key: 'cmc', label: `CMC ≤ ${maxCmc}`, onRemove: () => setCmcFilter(null) }] : []),
    ...(maxPrice !== null ? [{ key: 'price', label: `Under $${maxPrice}`, onRemove: () => setMaxPrice(null) }] : []),
    ...(oracleText.trim() ? [{ key: 'oracle', label: `o: "${oracleText.trim()}"`, onRemove: () => setOracleText('') }] : []),
    ...[...activeArtTypes].map(v => ({
      key: `art:${v}`,
      label: ART_TYPES.find(a => a.value === v)?.label ?? v,
      onRemove: () => toggleArtType(v),
    })),
    ...(activeSet ? [{ key: 'set', label: activeSet, onRemove: () => selectSet(activeSet) }] : []),
  ]

  // ── Card search handlers ──────────────────────────────────

  const anyBrewFilter = activeKeywords.length > 0 || activeTags.length > 0 || ownedOnly || activeColors.size > 0 || activeType !== null || maxCmc !== null || maxPrice !== null || brewRawQuery.trim() || oracleText.trim() || activeArtTypes.size > 0 || activeSet !== null

  // ── Filter controls (shared by mobile and desktop layouts) ──

  const colorPicker = (dotSize: string) => (
    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="flex gap-1.5">
        {COLOR_CHIPS.map(c => (
          <button key={c.symbol} onClick={() => toggleColor(c.symbol)} title={c.label}
            className={`${dotSize} rounded-full font-bold border-2 transition-all ${
              activeColors.has(c.symbol)
                ? `${c.activeBg} ${c.text} ${c.border} scale-110 shadow-md`
                : `${c.bg} ${c.text} border-transparent opacity-40 hover:opacity-70`
            }`}>
            {c.symbol}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {(['exact', 'includes', 'commander'] as const).map(mode => (
          <Chip key={mode} active={colorMode === mode} onClick={() => setColorMode(mode)}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Chip>
        ))}
      </div>
    </div>
  )

  const typeChips = (
    <div className="flex flex-wrap gap-1.5">
      {CARD_TYPES.map(t => (
        <Chip key={t} active={activeType === t.toLowerCase()} onClick={() => selectType(t.toLowerCase())}>{t}</Chip>
      ))}
    </div>
  )

  const cmcChips = (
    <div className="flex flex-wrap gap-1.5">
      <Chip active={maxCmc === null} onClick={() => setCmcFilter(null)}>Any</Chip>
      {CMC_PRESETS.map(n => (
        <Chip key={n} active={maxCmc === n} onClick={() => setCmcFilter(maxCmc === n ? null : n)}>≤{n}</Chip>
      ))}
    </div>
  )

  const priceChips = (
    <div className="flex flex-wrap gap-1.5">
      {PRICE_PRESETS.map(n => (
        <Chip key={n} active={maxPrice === n} onClick={() => setMaxPrice(maxPrice === n ? null : n)}>Under ${n}</Chip>
      ))}
      <Chip active={maxPrice === null} onClick={() => setMaxPrice(null)}>Any</Chip>
    </div>
  )

  const oracleInput = (
    <input
      value={oracleText}
      onChange={e => setOracleText(e.target.value)}
      placeholder='e.g. whenever you draw'
      className="w-full bg-stone-800 border-2 border-stone-700 rounded-lg px-3 py-2 text-base sm:text-sm text-stone-200 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors"
    />
  )

  const printingChips = (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-stone-500 mb-1.5">Art Style</p>
        <div className="flex flex-wrap gap-1.5">
          {ART_TYPES.map(a => (
            <Chip key={a.value} active={activeArtTypes.has(a.value)} onClick={() => toggleArtType(a.value)}>{a.label}</Chip>
          ))}
        </div>
      </div>
      {recentSets.length > 0 && (
        <div>
          <p className="text-xs text-stone-500 mb-1.5">Recent Sets</p>
          <div className="flex flex-wrap gap-1.5">
            {recentSets.map(s => (
              <Chip key={s.name} active={activeSet === s.name} onClick={() => selectSet(s.name)}>{s.name}</Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const sortControls = (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={`${sortBy}-${sortDir}`}
        onChange={e => {
          const [by, dir] = e.target.value.split('-') as [typeof sortBy, typeof sortDir]
          setSortBy(by)
          setSortDir(dir)
        }}
        className="text-xs px-2.5 py-1 rounded-full border-2 border-stone-700 bg-stone-800 text-stone-300 focus:outline-none focus:border-amber-600"
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Chip active={ownedOnly} onClick={() => setOwnedOnly(o => !o)}>Owned only</Chip>
      <Chip active={sortOwnedFirst} onClick={() => setSortOwnedFirst(o => !o)}>Owned first</Chip>
    </div>
  )


  // ── Chip search bar ───────────────────────────────────────

  useEffect(() => {
    loadTags().then(setAllTags)
  }, [])

  function addTag(slug: string) {
    setActiveTags(prev => prev.includes(slug) ? prev : [...prev, slug])
  }

  function removeTag(slug: string) {
    setActiveTags(prev => prev.filter(t => t !== slug))
  }

  function replaceTag(from: string, to: string) {
    setActiveTags(prev => prev.includes(to) ? prev.filter(t => t !== from) : prev.map(t => t === from ? to : t))
  }

  function toggleRole(tag: string) {
    const isActive = activeTags.some(t => t === tag || t.startsWith(`${tag}-`))
    if (isActive) setActiveTags(prev => prev.filter(t => t !== tag && !t.startsWith(`${tag}-`)))
    else addTag(tag)
  }

  function openNarrow(slug: string) {
    setShowAllNarrow(false)
    setNarrowTag(prev => prev === slug ? null : slug)
  }

  type Suggestion = { key: string; kind: 'tag' | 'keyword'; slug: string; label: string }

  const suggestions: Suggestion[] = useMemo(() => {
    const text = brewRawQuery.trim()
    if (!text) return []
    const tagMatches = allTags
      ? matchTags(allTags, text, SUGGESTION_LIMIT)
          .filter(t => !activeTags.includes(t))
          .map(t => ({ key: `tag:${t}`, kind: 'tag' as const, slug: t, label: formatTag(t) }))
      : []
    const matchedTagSlugs = new Set(tagMatches.map(t => t.slug))
    const keywordMatches = matchKeywords(text, 3)
      .filter(k => !activeKeywords.includes(k.slug))
      .filter(k => !matchedTagSlugs.has((k.query ?? `function:${k.slug}`).replace(/^function:/, '')))
      .map(k => ({ key: `kw:${k.slug}`, kind: 'keyword' as const, slug: k.slug, label: k.label }))
    return [...keywordMatches, ...tagMatches].slice(0, SUGGESTION_LIMIT)
  }, [brewRawQuery, allTags, activeTags, activeKeywords])

  function pickSuggestion(s: Suggestion) {
    if (s.kind === 'keyword') toggleKeyword(s.slug)
    else addTag(s.slug)
    setBrewRawQuery('')
    setHighlight(-1)
  }

  function handleBarKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && suggestions[highlight]) pickSuggestion(suggestions[highlight])
      else runBrewFetch(fullQuery, 1, false, ownedOnly)
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && brewRawQuery === '' && activeFilters.length > 0) {
      activeFilters[activeFilters.length - 1].onRemove()
    }
  }

  const narrowOptions = useMemo(() => {
    if (!narrowTag) return []
    const tag = narrowTag
    const children = (allTags ? childTags(allTags, tag) : []).map(child => ({
      key: `tag:${child}`,
      label: formatTag(child.slice(tag.length + 1)),
      onPick: () => { replaceTag(tag, child); setNarrowTag(child) },
    }))
    const related = relatedKeywords(tag).map(k => ({
      key: `kw:${k.slug}`,
      label: k.label,
      onPick: () => { removeTag(tag); if (!activeKeywords.includes(k.slug)) toggleKeyword(k.slug); setNarrowTag(null) },
    }))
    return [...children, ...related]
  }, [narrowTag, allTags, activeKeywords])

  const roleButtons = ROLES.map(role => {
    const isActive = activeTags.some(t => t === role.tag || t.startsWith(`${role.tag}-`))
    return (
      <button
        key={role.tag}
        onClick={() => toggleRole(role.tag)}
        className={`text-xs py-2 rounded-lg border-2 transition-colors ${
          isActive
            ? 'bg-amber-900/60 border-amber-600 text-amber-300'
            : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-amber-700/60 hover:text-amber-400'
        }`}
      >
        {role.label}
      </button>
    )
  })

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

      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          onClose={() => setPreviewCard(null)}
          onAddToWishlist={() => addToWishlist(previewCard.name, previewCard.id)}
          isAdding={wishlistLoading.has(previewCard.name)}
        />
      )}

      {/* ── Brew ──────────────────────────────────────── */}
      <div className="flex gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Chip search bar */}
            <div className="relative">
              <div className="flex gap-3">
                <div
                  onClick={() => inputRef.current?.focus()}
                  className={`flex-1 min-w-0 flex flex-wrap items-center gap-1.5 bg-stone-900 border-2 rounded-lg px-2.5 py-2 cursor-text transition-colors ${barFocused ? 'border-amber-600' : 'border-stone-700'}`}
                >
                  {activeFilters.map(f => (
                    <span key={f.key} className={`flex items-center text-xs rounded-full border-2 transition-colors ${
                      f.tag && narrowTag === f.tag
                        ? 'bg-amber-800/70 border-amber-400 text-amber-200'
                        : 'bg-amber-900/40 border-amber-700/60 text-amber-300'
                    }`}>
                      {f.tag ? (
                        <button onClick={e => { e.stopPropagation(); openNarrow(f.tag!) }} className="pl-2.5 pr-1 py-0.5 hover:text-amber-100">{f.label}</button>
                      ) : (
                        <span className="pl-2.5 pr-1 py-0.5">{f.label}</span>
                      )}
                      <button onClick={e => { e.stopPropagation(); f.onRemove() }} aria-label={`Remove ${f.label}`} className="pr-2 pl-0.5 py-0.5 text-amber-500 hover:text-amber-200">×</button>
                    </span>
                  ))}
                  <input
                    ref={inputRef}
                    value={brewRawQuery}
                    onChange={e => { setBrewRawQuery(e.target.value); setHighlight(-1) }}
                    onFocus={() => setBarFocused(true)}
                    onBlur={() => setBarFocused(false)}
                    onKeyDown={handleBarKeyDown}
                    placeholder={activeFilters.length > 0 ? 'Add more…' : 'Search cards or pick a role…'}
                    className="flex-1 min-w-[8rem] bg-transparent py-1 text-stone-100 placeholder-stone-500 focus:outline-none text-base sm:text-sm"
                  />
                </div>
                <button
                  onClick={() => runBrewFetch(fullQuery, 1, false, ownedOnly)}
                  disabled={brewLoading}
                  className="px-4 sm:px-6 py-3 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-amber-600 text-amber-200 disabled:opacity-50 rounded-lg font-medium transition-colors whitespace-nowrap self-start"
                >
                  {brewLoading ? '…' : 'Search'}
                </button>
              </div>

              {/* Dropdown: quick picks when empty, tag matches while typing */}
              {barFocused && (brewRawQuery.trim() ? suggestions.length > 0 : true) && (
                <div onMouseDown={e => e.preventDefault()} className="absolute left-0 right-0 sm:right-24 top-full mt-1 z-30 bg-stone-900 border-2 border-stone-700 rounded-lg shadow-xl overflow-hidden">
                  {brewRawQuery.trim() ? (
                    <div className="max-h-72 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button
                          key={s.key}
                          onClick={() => pickSuggestion(s)}
                          onMouseEnter={() => setHighlight(i)}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-stone-800 flex items-center justify-between gap-2 ${i === highlight ? 'bg-amber-900/40 text-amber-300' : 'text-stone-300'}`}
                        >
                          <span className="truncate">+ {s.label}</span>
                          <span className="text-xs text-stone-600 shrink-0">{s.kind === 'keyword' ? 'keyword' : 'tag'}</span>
                        </button>
                      ))}
                      <p className="px-3 py-2 text-xs text-stone-500">Enter searches &ldquo;{brewRawQuery.trim()}&rdquo; as text</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-3">
                      <div className="lg:hidden">
                        <p className="text-xs text-stone-500 mb-1.5">Roles</p>
                        <div className="grid grid-cols-4 gap-1.5">{roleButtons}</div>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500 mb-1.5">Price</p>
                        {priceChips}
                      </div>
                      <button onClick={() => { setBrowseOpen(true); inputRef.current?.blur() }} className="lg:hidden text-xs text-amber-500 hover:text-amber-400">Browse all tags ▸</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-1">
                <button onClick={() => setShowQuery(s => !s)} className="text-xs text-stone-600 hover:text-stone-400">{showQuery ? 'Hide query' : 'Show query'}</button>
              </div>
              {showQuery && (
                <p className="text-xs font-mono text-stone-400 bg-stone-900/60 border border-stone-800 rounded-lg px-3 py-2 break-words">{fullQuery || '(empty)'}</p>
              )}
            </div>

            {/* Desktop role row */}
            <div className="hidden lg:grid grid-cols-8 gap-2">{roleButtons}</div>

            {/* Narrow panel: bottom sheet on mobile, inline on desktop */}
            {narrowTag && (
              <>
                <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setNarrowTag(null)} />
                <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto bg-stone-900 border-t-2 border-stone-700 rounded-t-2xl p-4 lg:static lg:z-auto lg:max-h-none lg:border-2 lg:border-dashed lg:border-stone-700 lg:rounded-xl lg:p-3">
                  <div className="w-10 h-1 bg-stone-600 rounded-full mx-auto mb-3 lg:hidden" />
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-stone-200">Narrow {formatTag(narrowTag).toLowerCase()}</p>
                    <button onClick={() => setNarrowTag(null)} className="text-stone-500 hover:text-stone-200 text-lg leading-none" aria-label="Close">×</button>
                  </div>
                  {narrowOptions.length === 0 ? (
                    <p className="text-xs text-stone-600">No narrower tags for this one.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(showAllNarrow ? narrowOptions : narrowOptions.slice(0, NARROW_PREVIEW)).map(o => (
                        <Chip key={o.key} active={false} onClick={o.onPick}>{o.label}</Chip>
                      ))}
                      {!showAllNarrow && narrowOptions.length > NARROW_PREVIEW && (
                        <button onClick={() => setShowAllNarrow(true)} className="text-xs text-amber-500 hover:text-amber-400 px-1">+{narrowOptions.length - NARROW_PREVIEW} more</button>
                      )}
                    </div>
                  )}
                  <button onClick={() => { removeTag(narrowTag); setNarrowTag(null) }} className="mt-3 text-xs text-red-400 hover:text-red-300">Remove {formatTag(narrowTag).toLowerCase()}</button>
                </div>
              </>
            )}

            {/* Mobile accordion — hidden on desktop */}
            <div className="lg:hidden space-y-1">
              <AccordionRow title="Colors" count={activeColors.size} open={colorsOpen} onToggle={() => setColorsOpen(o => !o)}>
                {colorPicker('w-9 h-9 text-sm')}
              </AccordionRow>

              <AccordionRow title="Type and CMC" count={(activeType ? 1 : 0) + (maxCmc !== null ? 1 : 0)} open={typeCmcOpen} onToggle={() => setTypeCmcOpen(o => !o)}>
                <div className="space-y-3">
                  {typeChips}
                  {cmcChips}
                </div>
              </AccordionRow>

              <AccordionRow title="Browse all tags" count={activeTags.length} open={browseOpen} onToggle={() => setBrowseOpen(o => !o)}>
                <TagBrowser tags={allTags} activeTags={activeTags} onPick={addTag} />
              </AccordionRow>

              <AccordionRow title="Price" count={maxPrice !== null ? 1 : 0} open={priceOpen} onToggle={() => setPriceOpen(o => !o)}>
                {priceChips}
              </AccordionRow>

              <AccordionRow title="Oracle Text" count={oracleText.trim() ? 1 : 0} open={oracleOpen} onToggle={() => setOracleOpen(o => !o)}>
                {oracleInput}
              </AccordionRow>

              <AccordionRow title="Printing" count={activeArtTypes.size + (activeSet ? 1 : 0)} open={printingOpen} onToggle={() => setPrintingOpen(o => !o)}>
                {printingChips}
              </AccordionRow>

              <div className="flex items-center justify-between pt-0.5 flex-wrap gap-2">
                {sortControls}
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">Color</span>
                  {colorPicker('w-7 h-7 text-xs')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">Type</span>
                  {typeChips}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">CMC</span>
                  {cmcChips}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">Price</span>
                  {priceChips}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">Oracle Text</span>
                  <div className="flex-1">{oracleInput}</div>
                </div>
                <AccordionRow title="Printing" count={activeArtTypes.size + (activeSet ? 1 : 0)} open={printingOpen} onToggle={() => setPrintingOpen(o => !o)}>
                  {printingChips}
                </AccordionRow>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 shrink-0 w-20">Sort</span>
                  {sortControls}
                </div>
              </div>
              )}
            </div>

            {/* Error */}
            {brewError && (
              <div className="bg-red-900/30 border-2 border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{brewError}</div>
            )}

            {/* Empty state */}
            {!brewLoading && allFetchedCards.length === 0 && !brewError && !anyBrewFilter && (
              <div className="text-center py-16 text-stone-600">
                <p className="text-3xl mb-3">🍺</p>
                <p className="text-sm">Pick a role or type to start brewing.</p>
              </div>
            )}

            {/* Results header + pagination controls */}
            {(brewLoading || allFetchedCards.length > 0) && (
              <div id="search-results" className="flex items-center justify-between gap-4">
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
                    onPreview={() => setPreviewCard(c)}
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

          {/* Desktop tag sidebar */}
          <div className="hidden lg:block w-64 shrink-0">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-3">Browse tags</p>
            <TagBrowser tags={allTags} activeTags={activeTags} onPick={addTag} />
          </div>

        </div>
    </div>
  )
}
