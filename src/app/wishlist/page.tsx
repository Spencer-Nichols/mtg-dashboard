'use client'

import { useState, useEffect, useRef } from 'react'

function CardImage({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`${className} aspect-[63/88] bg-stone-800 flex items-center justify-center`}>
        <span className="text-stone-600 text-xs">No image</span>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

interface SealedWishlistItem {
  id: string
  tcgProductId: number
  tcgGroupId: number
  productName: string
  setName: string
  snapshotPrice: number
  imageUrl: string | null
  targetPrice: number | null
}

interface SealedResult {
  id: string
  productId: number
  productName: string
  setName: string
  snapshotPrice: number
  currentPrice: number | null
  pct: number | null
  imageUrl: string | null
  priceSource?: 'manapool' | 'tcgplayer' | null
  manapoolUrl?: string | null
}

interface TcgGroup {
  groupId: number
  name: string
  abbreviation: string
  publishedOn: string
}

interface SealedProductOption {
  productId: number
  name: string
  imageUrl: string | null
  price: number | null
}

interface CardResult {
  displayName: string
  snapshotPrice: number
  currentPrice: number | null
  pct: number | null
  imageUrl: string | null
  note?: string
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
  priceSource?: 'manapool' | 'scryfall' | null
  manapoolUrl?: string | null
}

type Candidate = { scryfallId?: string; name: string; setCode: string; setName: string; price: number | null; foilPrice?: number | null; type_line: string; collectorNumber?: string; rarity?: string; releasedAt?: string; imageUrl?: string | null }

const BUY_THRESHOLD = -10

const LS_WISHLIST_SINGLES = 'tnk:wishlist:singles'
const LS_WISHLIST_RESULTS = 'tnk:wishlist:results'
const LS_WISHLIST_HISTORY = 'tnk:wishlist:history'
const LS_SEALED_ITEMS = 'tnk:wishlist:sealed'
const LS_SEALED_RESULTS = 'tnk:wishlist:sealed:results'
const LS_SEALED_HISTORY = 'tnk:wishlist:sealed:history'

function pctColor(pct: number | null) {
  if (pct === null) return 'text-stone-500'
  if (pct > 0.05) return 'text-green-400'
  if (pct < -0.05) return 'text-red-400'
  return 'text-stone-400'
}

function pctLabel(pct: number | null) {
  if (pct === null) return '—'
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : ''
  return `${arrow}${Math.abs(pct).toFixed(1)}%`
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 100, h = 24, pad = 1.5
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const trend = values[values.length - 1] - values[0]
  const color = trend > 0 ? '#4ade80' : trend < 0 ? '#f87171' : '#6b7280'
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function WishlistCard({ row, onDelete, onMoveToBinder, sparkline, isStale }: { row: CardResult; onDelete: (name: string) => void; onMoveToBinder: (name: string) => void; sparkline?: number[]; isStale?: boolean }) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState(row.note ?? '')
  const [currentNote, setCurrentNote] = useState(row.note ?? '')
  const [showMenu, setShowMenu] = useState(false)
  const [menuNote, setMenuNote] = useState('')
  const cancelNoteRef = useRef(false)

  function commitNote() {
    setEditingNote(false)
    if (cancelNoteRef.current) { cancelNoteRef.current = false; setNoteVal(currentNote); return }
    const trimmed = noteVal.trim()
    if (trimmed === currentNote) return
    setCurrentNote(trimmed)
    fetch('/api/wishlist/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: row.displayName, note: trimmed }),
    })
  }

  function openMenu() {
    setMenuNote(currentNote)
    setShowMenu(true)
  }

  function saveMenuNote() {
    const trimmed = menuNote.trim()
    if (trimmed === currentNote) return
    setCurrentNote(trimmed)
    setNoteVal(trimmed)
    fetch('/api/wishlist/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: row.displayName, note: trimmed }),
    })
  }

  const manapoolSlug = row.displayName
    .replace(/\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div className="relative rounded-xl overflow-hidden shadow-lg">
        <a
          href={row.priceSource === 'manapool'
            ? (row.manapoolUrl ?? `https://manapool.com/card/${manapoolSlug}`)
            : `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(row.displayName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          title={row.priceSource === 'manapool' ? 'View on Manapool' : 'View on TCGPlayer'}
        >
          {row.imageUrl
            ? <img src={row.imageUrl} alt={row.displayName} className="w-full block group-hover:brightness-110 transition-all" />
            : <div className="aspect-[5/7] bg-stone-800 rounded-xl animate-pulse" />}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-10 pointer-events-none">
            <span className={`text-xs px-3 py-1 rounded-full font-medium border-2 bg-stone-900/90 ${
              row.priceSource === 'manapool'
                ? 'border-blue-600/60 text-blue-400'
                : 'border-amber-700/60 text-amber-400'
            }`}>
              {row.priceSource === 'manapool' ? 'View on Manapool' : 'View on TCGPlayer'}
            </span>
          </div>
        </a>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
          {row.pct != null && (
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
              row.pct > 0.05 ? 'bg-green-900/80 text-green-300' :
              row.pct < -0.05 ? 'bg-red-900/80 text-red-300' :
              'bg-stone-800/80 text-stone-400'
            }`}>
              {pctLabel(row.pct)}
            </div>
          )}
          {isStale && (
            <div className="text-xs px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-500 backdrop-blur-sm">
              Stale
            </div>
          )}
        </div>
        <div className="absolute bottom-2 left-0 right-0 hidden sm:flex justify-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onMoveToBinder(row.displayName) }}
            className="whitespace-nowrap text-xs px-3 py-1 rounded-full bg-stone-900/90 border-2 border-amber-700/50 text-amber-400 hover:bg-amber-900/40 transition-colors"
          >
            → Binder
          </button>
          <button
            onClick={e => { e.preventDefault(); onDelete(row.displayName) }}
            className="whitespace-nowrap text-xs px-3 py-1 rounded-full bg-stone-900/90 border border-red-800/50 text-red-400 hover:bg-red-900/40 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="px-0.5 flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <p className="text-sm text-stone-200 font-semibold leading-tight" title={row.displayName}>{row.displayName}</p>
            {row.typeLine && <p className="text-xs text-stone-500 leading-tight">{row.typeLine}</p>}
            {(row.setName || row.setCode) && (
              <p className="text-xs text-stone-500">
                {row.setName ?? ''}{row.setCode ? ` (${row.setCode.toUpperCase()})` : ''}
              </p>
            )}
            {row.rarity && (
              <p className={`text-xs font-medium capitalize ${
                row.rarity === 'mythic' ? 'text-orange-400' :
                row.rarity === 'rare' ? 'text-yellow-400' :
                row.rarity === 'uncommon' ? 'text-blue-400' : 'text-stone-500'
              }`}>{row.rarity}</p>
            )}
          </div>
          <button
            onClick={openMenu}
            className="sm:hidden shrink-0 text-stone-400 border border-stone-700 bg-stone-800 rounded-full px-2 py-0.5 text-sm leading-none transition-colors active:bg-stone-700"
          >⋯</button>
        </div>
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-1">
            <Sparkline values={sparkline} />
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-sm font-mono font-semibold ${pctColor(row.pct)}`}>
            ${(row.currentPrice ?? row.snapshotPrice).toFixed(2)}
          </span>
          {row.priceSource && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              row.priceSource === 'manapool'
                ? 'bg-blue-950/50 text-blue-400 border-blue-800/40'
                : 'bg-amber-950/50 text-amber-400 border-amber-800/40'
            }`}>
              {row.priceSource === 'manapool' ? 'MP' : 'TCG'}
            </span>
          )}
          {row.snapshotPrice > 0 && row.currentPrice != null && row.currentPrice !== row.snapshotPrice && (
            <span className="text-xs text-stone-600 font-mono">was ${row.snapshotPrice.toFixed(2)}</span>
          )}
        </div>
        {currentNote && <span className="sm:hidden text-xs text-stone-500 px-0.5">{currentNote}</span>}
        {editingNote ? (
          <input
            autoFocus
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onBlur={commitNote}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
              if (e.key === 'Escape') { cancelNoteRef.current = true; (e.target as HTMLInputElement).blur() }
            }}
            className="hidden sm:block text-xs px-1.5 py-0.5 rounded bg-stone-800 border-2 border-amber-700 text-stone-200 placeholder-stone-600 focus:outline-none w-full"
            placeholder="Add a note..."
          />
        ) : (
          <span
            onClick={() => { setNoteVal(currentNote); setEditingNote(true) }}
            className={`hidden sm:block text-xs cursor-text px-1 rounded hover:bg-stone-700 transition-colors ${currentNote ? 'text-stone-400' : 'opacity-0 group-hover:opacity-100 text-stone-600'}`}
          >
            {currentNote || '+ note'}
          </span>
        )}
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:hidden bg-black/60 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <div className="w-full bg-stone-900 border border-stone-700 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-stone-200 font-semibold text-sm truncate pr-4">{row.displayName}</p>
              <button onClick={() => setShowMenu(false)} className="text-stone-500 hover:text-stone-300 text-2xl leading-none">×</button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Note</label>
              <input
                value={menuNote}
                onChange={e => setMenuNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                onKeyDown={e => { if (e.key === 'Enter') { saveMenuNote(); setShowMenu(false) } }}
              />
            </div>
            <button
              onClick={() => { saveMenuNote(); onMoveToBinder(row.displayName); setShowMenu(false) }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-stone-800 border border-amber-700/50 text-amber-400 active:bg-stone-700 transition-colors"
            >
              → Move to Binder
            </button>
            <button
              onClick={() => { saveMenuNote(); onDelete(row.displayName); setShowMenu(false) }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-red-950/40 border border-red-800/50 text-red-400 active:bg-red-900/40 transition-colors"
            >
              Remove from Wishlist
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SealedProductTile({ item, onDelete, sparkline, isAtl, targetPrice, onSetTargetPrice }: {
  item: SealedResult
  onDelete: (id: string) => void
  sparkline?: number[]
  isAtl?: boolean
  targetPrice?: number | null
  onSetTargetPrice?: (id: string, price: number | null) => void
}) {
  const [editingAlert, setEditingAlert] = useState(false)
  const [alertValue, setAlertValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [menuAlertValue, setMenuAlertValue] = useState('')

  const suffix = (item.productName.includes(' - ')
    ? item.productName.slice(item.productName.indexOf(' - ') + 3)
    : item.productName).replace(/\s+Display$/i, '')

  function openAlert() {
    setAlertValue(targetPrice != null ? targetPrice.toFixed(2) : '')
    setEditingAlert(true)
  }

  function saveAlert() {
    const parsed = alertValue.trim() ? parseFloat(alertValue) : null
    onSetTargetPrice?.(item.id, parsed && !isNaN(parsed) ? parsed : null)
    setEditingAlert(false)
  }

  function openMenu() {
    setMenuAlertValue(targetPrice != null ? targetPrice.toFixed(2) : '')
    setShowMenu(true)
  }

  function saveMenuAlert() {
    const parsed = menuAlertValue.trim() ? parseFloat(menuAlertValue) : null
    onSetTargetPrice?.(item.id, parsed && !isNaN(parsed) ? parsed : null)
  }

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div className="relative rounded-xl overflow-hidden shadow-lg bg-stone-800">
        <a
          href={item.priceSource === 'manapool'
            ? (item.manapoolUrl ?? `https://manapool.com`)
            : `https://www.tcgplayer.com/product/${item.productId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          title={item.priceSource === 'manapool' ? 'View on Manapool' : 'View on TCGPlayer'}
        >
          <div className="aspect-[4/3] bg-white flex items-center justify-center">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain group-hover:brightness-110 transition-all" />
              : null}
          </div>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-10 pointer-events-none">
            <span className={`text-xs px-3 py-1 rounded-full font-medium border-2 bg-stone-900/90 ${
              item.priceSource === 'manapool'
                ? 'border-blue-600/60 text-blue-400'
                : 'border-amber-700/60 text-amber-400'
            }`}>

              {item.priceSource === 'manapool' ? 'View on Manapool' : 'View on TCGPlayer'}
            </span>
          </div>
        </a>
        {(isAtl || item.pct != null) && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
            {isAtl && (
              <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-900/90 text-green-300 backdrop-blur-sm">
                ↓ ATL
              </div>
            )}
            {item.pct != null && (
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
                item.pct > 0.05 ? 'bg-green-900/80 text-green-300' :
                item.pct < -0.05 ? 'bg-red-900/80 text-red-300' :
                'bg-stone-800/80 text-stone-400'
              }`}>
                {pctLabel(item.pct)}
              </div>
            )}
          </div>
        )}
        <div className="absolute bottom-2 left-0 right-0 hidden sm:flex justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(item.id)}
            className="text-xs px-3 py-1 rounded-full bg-stone-900/90 border border-red-800/50 text-red-400 hover:bg-red-900/40 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="px-0.5 flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs sm:text-sm font-semibold leading-tight min-w-0 flex-1">
            {item.setName && <span className="text-stone-200 font-normal">{item.setName} · </span>}
            <span className="text-stone-200">{suffix}</span>
          </p>
          <button
            onClick={openMenu}
            className="sm:hidden shrink-0 text-stone-400 border border-stone-700 bg-stone-800 rounded-full px-2 py-0.5 text-sm leading-none transition-colors active:bg-stone-700"
          >⋯</button>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-sm font-mono font-semibold ${pctColor(item.pct)}`}>
            {item.currentPrice != null ? `$${item.currentPrice.toFixed(2)}` : item.snapshotPrice > 0 ? `$${item.snapshotPrice.toFixed(2)}` : '—'}
          </span>
          {item.priceSource && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              item.priceSource === 'manapool'
                ? 'bg-blue-950/50 text-blue-400 border-blue-800/40'
                : 'bg-amber-950/50 text-amber-400 border-amber-800/40'
            }`}>
              {item.priceSource === 'manapool' ? 'MP' : 'TCG'}
            </span>
          )}
          {item.snapshotPrice > 0 && item.currentPrice != null && item.currentPrice !== item.snapshotPrice && (
            <span className="hidden sm:inline text-xs text-stone-600 font-mono">was ${item.snapshotPrice.toFixed(2)}</span>
          )}
          {onSetTargetPrice && (
            editingAlert ? (
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-stone-500 text-xs">Alert &lt; $</span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={alertValue}
                  onChange={e => setAlertValue(e.target.value)}
                  onBlur={saveAlert}
                  onKeyDown={e => { if (e.key === 'Enter') saveAlert(); if (e.key === 'Escape') setEditingAlert(false) }}
                  className="w-16 bg-stone-800 border border-stone-600 rounded px-1.5 py-0.5 text-xs text-stone-100 focus:outline-none focus:border-amber-600"
                />
              </div>
            ) : (
              <button
                onClick={openAlert}
                className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  targetPrice != null
                    ? 'bg-orange-950/40 border-orange-800/50 text-orange-400 hover:bg-orange-900/40'
                    : 'bg-stone-800/60 border-stone-700 text-stone-500 hover:text-stone-300'
                }`}
              >
                {targetPrice != null
                  ? <>⚑ alert &lt; ${targetPrice.toFixed(2)}</>
                  : <>+ alert price</>
                }
              </button>
            )
          )}
        </div>
        {targetPrice != null && (
          <span className="sm:hidden text-xs text-orange-400">⚑ alert &lt; ${targetPrice.toFixed(2)}</span>
        )}
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-1">
            <Sparkline values={sparkline} />
          </div>
        )}
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:hidden bg-black/60 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <div className="w-full bg-stone-900 border border-stone-700 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-stone-200 font-semibold text-sm">{suffix}</p>
                {item.setName && <p className="text-xs text-stone-500 mt-0.5">{item.setName}</p>}
              </div>
              <button onClick={() => setShowMenu(false)} className="text-stone-500 hover:text-stone-300 text-2xl leading-none">×</button>
            </div>
            {onSetTargetPrice && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-stone-500">Alert price</label>
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-sm shrink-0">Alert &lt; $</span>
                  <input
                    type="number"
                    step="0.01"
                    value={menuAlertValue}
                    onChange={e => setMenuAlertValue(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                    onKeyDown={e => { if (e.key === 'Enter') { saveMenuAlert(); setShowMenu(false) } }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => { saveMenuAlert(); setShowMenu(false) }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-stone-800 border border-stone-700 text-stone-300 active:bg-stone-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { onDelete(item.id); setShowMenu(false) }}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-red-950/40 border border-red-800/50 text-red-400 active:bg-red-900/40 transition-colors"
            >
              Remove from Wishlist
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WishlistPage() {
  const [singles, setSingles] = useState<{ name: string; note?: string; snapshotPrice: number | null }[]>([])
  const [results, setResults] = useState<Map<string, CardResult>>(new Map())
  const [streaming, setStreaming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [addQuery, setAddQuery] = useState('')
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addCandidates, setAddCandidates] = useState<Candidate[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024
  const [addMode, setAddMode] = useState<'single' | 'sealed'>('single')
  const [sealedOpen, setSealedOpen] = useState(isDesktop)
  const [cardsOpen, setCardsOpen] = useState(isDesktop)
  const [staleResetLoading, setStaleResetLoading] = useState(false)
  const [addPrintings, setAddPrintings] = useState<Candidate[]>([])
  const [addPrintingName, setAddPrintingName] = useState<string | null>(null)
  const [printingModalOpen, setPrintingModalOpen] = useState(false)
  const [wishlistHistory, setWishlistHistory] = useState<Record<string, Array<{ date: string; price: number }>>>({})
  const [sealedHistory, setSealedHistory] = useState<Record<number, Array<{ date: string; price: number }>>>({})
  const [sealedLastRun, setSealedLastRun] = useState<Date | null>(null)
  const [dismissedSealed, setDismissedSealed] = useState<Record<number, number>>({})
  const [dismissedWishlist, setDismissedWishlist] = useState<Record<string, number>>({})

  function getSealedDismissed(): Record<number, number> {
    try { return JSON.parse(localStorage.getItem('tnk:sealed:dismissed') ?? '{}') } catch { return {} }
  }

  function getWishlistDismissed(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem('tnk:wishlist:dismissed') ?? '{}') } catch { return {} }
  }

  function isSealedDismissed(productId: number, currentPrice: number): boolean {
    const d = dismissedSealed[productId]
    return d != null && currentPrice >= d - 0.25
  }

  function isWishlistCardDismissed(displayName: string, currentPrice: number | null): boolean {
    if (currentPrice == null) return false
    const d = dismissedWishlist[displayName]
    return d != null && currentPrice >= d - 0.25
  }

  function dismissSealed(productId: number, price: number) {
    const next = { ...getSealedDismissed(), [productId]: price }
    localStorage.setItem('tnk:sealed:dismissed', JSON.stringify(next))
    setDismissedSealed(next)
  }

  function dismissWishlistCard(displayName: string, price: number) {
    const next = { ...getWishlistDismissed(), [displayName]: price }
    localStorage.setItem('tnk:wishlist:dismissed', JSON.stringify(next))
    setDismissedWishlist(next)
  }
  const [sealedItems, setSealedItems] = useState<SealedWishlistItem[]>([])
  const [sealedResults, setSealedResults] = useState<Map<string, SealedResult>>(new Map())
  const [sealedStreaming, setSealedStreaming] = useState(false)
  const [sealedProgress, setSealedProgress] = useState(0)
  const [sealedTotal, setSealedTotal] = useState(0)
  const [sealedQuery, setSealedQuery] = useState('')
  const [sealedGroups, setSealedGroups] = useState<TcgGroup[]>([])
  const [sealedGroupsLoaded, setSealedGroupsLoaded] = useState(false)
  const [sealedSelectedGroup, setSealedSelectedGroup] = useState<TcgGroup | null>(null)
  const [sealedProducts, setSealedProducts] = useState<SealedProductOption[]>([])
  const [sealedProductsLoading, setSealedProductsLoading] = useState(false)
  const [sealedShowDropdown, setSealedShowDropdown] = useState(false)
  const [sealedAdding, setSealedAdding] = useState<number | null>(null)
  const [sealedAddError, setSealedAddError] = useState('')
  const [pendingSealedProduct, setPendingSealedProduct] = useState<SealedProductOption | null>(null)
  const [pendingTargetPrice, setPendingTargetPrice] = useState('')
  const [sealedModalOpen, setSealedModalOpen] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const sealedEsRef = useRef<EventSource | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const staleResetRef = useRef<Set<string>>(new Set())
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const sealedDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'wishlist' }) })

    const cachedSingles = localStorage.getItem(LS_WISHLIST_SINGLES)
    const cachedResults = localStorage.getItem(LS_WISHLIST_RESULTS)
    const cachedHistory = localStorage.getItem(LS_WISHLIST_HISTORY)
    const cachedSealedItems = localStorage.getItem(LS_SEALED_ITEMS)
    const cachedSealedResults = localStorage.getItem(LS_SEALED_RESULTS)
    if (cachedSingles) setSingles(JSON.parse(cachedSingles))
    if (cachedResults) setResults(new Map(JSON.parse(cachedResults)))
    if (cachedHistory) setWishlistHistory(JSON.parse(cachedHistory))
    if (cachedSealedItems) setSealedItems(JSON.parse(cachedSealedItems))
    if (cachedSealedResults) setSealedResults(new Map(JSON.parse(cachedSealedResults)))

    fetch('/api/wishlist')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSingles(data)
          localStorage.setItem(LS_WISHLIST_SINGLES, JSON.stringify(data))
          startStream()
        }
      })
    fetch('/api/wishlist/history').then(r => r.json()).then(h => {
      if (h && typeof h === 'object') {
        setWishlistHistory(h)
        localStorage.setItem(LS_WISHLIST_HISTORY, JSON.stringify(h))
      }
    })
    const cachedSealedHistory = localStorage.getItem(LS_SEALED_HISTORY)
    if (cachedSealedHistory) setSealedHistory(JSON.parse(cachedSealedHistory))
    setDismissedSealed(getSealedDismissed())
    setDismissedWishlist(getWishlistDismissed())
    fetch('/api/sealed/last-run').then(r => r.json()).then(d => {
      if (d.lastRun) setSealedLastRun(new Date(d.lastRun))
    })
    fetch('/api/sealed/history').then(r => r.json()).then(h => {
      if (h && typeof h === 'object') {
        setSealedHistory(h)
        localStorage.setItem(LS_SEALED_HISTORY, JSON.stringify(h))
      }
    })
    fetch('/api/sealed/wishlist')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const items: SealedWishlistItem[] = data.map(d => ({
            id: d.id,
            tcgProductId: d.tcg_product_id,
            tcgGroupId: d.tcg_group_id,
            productName: d.product_name,
            setName: d.set_name,
            snapshotPrice: d.snapshot_price ?? 0,
            imageUrl: d.image_url ?? null,
            targetPrice: d.target_price ?? null,
          }))
          setSealedItems(items)
          localStorage.setItem(LS_SEALED_ITEMS, JSON.stringify(items))
          if (items.length > 0) startSealedStream()
        }
      })

    const interval = setInterval(() => startStream(true), 60 * 60 * 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (streaming) return
    rows.forEach(row => {
      if (!isStaleFor4Days(row) || row.currentPrice == null) return
      if (staleResetRef.current.has(row.displayName)) return
      staleResetRef.current.add(row.displayName)
      fetch('/api/wishlist/snapshot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.displayName, snapshotPrice: row.currentPrice }),
      })
      setSingles(prev => prev.map(s => s.name === row.displayName ? { ...s, snapshotPrice: row.currentPrice! } : s))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (sealedDropdownRef.current && !sealedDropdownRef.current.contains(e.target as Node)) {
        setSealedShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  function startStream(bust = false) {
    if (streaming) return
    esRef.current?.close()
    if (bust) setResults(new Map())
    setProgress(0)
    setStreaming(true)

    const es = new EventSource(`/api/wishlist/stream${bust ? '?bust=true' : ''}`)
    esRef.current = es

    es.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'total') {
        setTotal(msg.count)
      } else if (msg.type === 'card') {
        setResults(prev => {
          const next = new Map(prev)
          next.set(msg.name, {
            displayName: msg.name,
            snapshotPrice: msg.snapshotPrice ?? 0,
            currentPrice: msg.currentPrice,
            pct: msg.pct,
            imageUrl: msg.imageUrl,
            note: msg.note,
            setName: msg.setName,
            setCode: msg.setCode,
            rarity: msg.rarity,
            typeLine: msg.typeLine,
            priceSource: msg.priceSource ?? null,
            manapoolUrl: msg.manapoolUrl ?? null,
          })
          return next
        })
        setProgress(p => p + 1)
      } else if (msg.type === 'done') {
        setStreaming(false)
        setUpdatedAt(new Date())
        es.close()
        setResults(prev => {
          localStorage.setItem(LS_WISHLIST_RESULTS, JSON.stringify(Array.from(prev.entries())))
          return prev
        })
      }
    }

    es.onerror = () => { setStreaming(false); es.close() }
  }

  function startSealedStream(bust = false) {
    if (sealedStreaming) return
    sealedEsRef.current?.close()
    if (bust) setSealedResults(new Map())
    setSealedProgress(0)
    setSealedStreaming(true)

    const es = new EventSource('/api/sealed/stream')
    sealedEsRef.current = es

    es.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'total') {
        setSealedTotal(msg.count)
      } else if (msg.type === 'product') {
        setSealedResults(prev => {
          const next = new Map(prev)
          next.set(msg.id, {
            id: msg.id,
            productId: msg.productId,
            productName: msg.productName,
            setName: msg.setName,
            snapshotPrice: msg.snapshotPrice ?? 0,
            currentPrice: msg.currentPrice,
            pct: msg.pct,
            imageUrl: msg.imageUrl,
            priceSource: msg.priceSource ?? null,
          manapoolUrl: msg.manapoolUrl ?? null,
          })
          return next
        })
        setSealedProgress(p => p + 1)
      } else if (msg.type === 'done') {
        setSealedStreaming(false)
        es.close()
        setSealedResults(prev => {
          localStorage.setItem(LS_SEALED_RESULTS, JSON.stringify(Array.from(prev.entries())))
          return prev
        })
      }
    }

    es.onerror = () => { setSealedStreaming(false); es.close() }
  }

  async function deleteSealedItem(id: string) {
    await fetch('/api/sealed/wishlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSealedItems(prev => {
      const next = prev.filter(s => s.id !== id)
      localStorage.setItem(LS_SEALED_ITEMS, JSON.stringify(next))
      return next
    })
    setSealedResults(prev => {
      const next = new Map(prev)
      next.delete(id)
      localStorage.setItem(LS_SEALED_RESULTS, JSON.stringify(Array.from(next.entries())))
      return next
    })
  }

  async function loadSealedGroups() {
    if (sealedGroupsLoaded) return
    const data = await fetch('/api/sealed/groups').then(r => r.json())
    if (Array.isArray(data)) {
      setSealedGroups(data)
      setSealedGroupsLoaded(true)
    }
  }

  async function selectSealedGroup(group: TcgGroup) {
    setSealedSelectedGroup(group)
    setSealedQuery('')
    setSealedShowDropdown(false)
    setPendingSealedProduct(null)
    setPendingTargetPrice('')
    setSealedAddError('')
    setSealedModalOpen(true)
    setSealedProductsLoading(true)
    setSealedProducts([])
    const res = await fetch(`/api/sealed/products?groupId=${group.groupId}&groupName=${encodeURIComponent(group.name)}`)
    const data = await res.json()
    if (Array.isArray(data)) setSealedProducts(data)
    setSealedProductsLoading(false)
  }

  function closeSealedModal() {
    setSealedModalOpen(false)
    setSealedSelectedGroup(null)
    setSealedProducts([])
    setPendingSealedProduct(null)
    setPendingTargetPrice('')
    setSealedAddError('')
  }

  async function addSealedProduct(p: SealedProductOption, targetPrice?: number | null): Promise<boolean> {
    if (!sealedSelectedGroup) return false
    setSealedAdding(p.productId)
    setSealedAddError('')
    const res = await fetch('/api/sealed/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tcgProductId: p.productId,
        tcgGroupId: sealedSelectedGroup.groupId,
        productName: p.name,
        setName: sealedSelectedGroup.name,
        snapshotPrice: p.price,
        imageUrl: p.imageUrl,
        targetPrice: targetPrice ?? null,
      }),
    })
    const data = await res.json()
    const ok = res.ok
    if (!ok) {
      setSealedAddError(data.error ?? 'Something went wrong')
    } else {
      handleSealedAdded()
    }
    setSealedAdding(null)
    return ok
  }

  async function confirmSealedAdd() {
    if (!pendingSealedProduct) return
    const tp = pendingTargetPrice.trim() ? parseFloat(pendingTargetPrice) : null
    const ok = await addSealedProduct(pendingSealedProduct, tp && !isNaN(tp) ? tp : null)
    if (ok) closeSealedModal()
    if (!ok) { setPendingSealedProduct(null); setPendingTargetPrice('') }
  }

  async function updateSealedTargetPrice(id: string, targetPrice: number | null) {
    setSealedItems(prev => prev.map(s => s.id === id ? { ...s, targetPrice } : s))
    await fetch('/api/sealed/wishlist/target', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, targetPrice }),
    })
  }

  function handleSealedAdded() {
    fetch('/api/sealed/wishlist')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const items: SealedWishlistItem[] = data.map(d => ({
            id: d.id,
            tcgProductId: d.tcg_product_id,
            tcgGroupId: d.tcg_group_id,
            productName: d.product_name,
            setName: d.set_name,
            snapshotPrice: d.snapshot_price ?? 0,
            imageUrl: d.image_url ?? null,
            targetPrice: d.target_price ?? null,
          }))
          setSealedItems(items)
          localStorage.setItem(LS_SEALED_ITEMS, JSON.stringify(items))
          startSealedStream(true)
        }
      })
  }

  function handleAddInput(value: string) {
    setAddQuery(value)
    setAddCandidates([])
    setAddPrintings([])
    setAddPrintingName(null)
    setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) return
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/card?q=${encodeURIComponent(value)}&candidates=true`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) { setAddCandidates(data); setShowDropdown(true) }
      }
    }, 400)
  }

  async function selectNameForPrinting(name: string) {
    setAddCandidates([])
    setShowDropdown(false)
    setAddPrintingName(name)
    setAddPrintings([])
    setPrintingModalOpen(true)
    const res = await fetch(`/api/card?q=${encodeURIComponent(name)}&prints=true`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) { setAddPrintings(data) }
    }
  }

  async function addCard(name = addQuery, setCode?: string, scryfallId?: string) {
    if (!name.trim()) return
    setAddLoading(true)
    setAddStatus(null)
    setAddCandidates([])
    setAddPrintings([])
    setAddPrintingName(null)
    setShowDropdown(false)
    setPrintingModalOpen(false)
    const res = await fetch('/api/wishlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), setCode, scryfallId }),
    })
    const data = await res.json()
    if (data.candidates) {
      setAddCandidates(data.candidates)
      setShowDropdown(true)
    } else if (!res.ok) {
      setAddStatus({ type: 'error', message: data.error })
    } else {
      setAddStatus({ type: 'success', message: `Added ${data.name} — $${data.price?.toFixed(2) ?? '?'}` })
      setAddQuery('')
      setResults(prev => {
        const next = new Map(prev)
        next.set(data.name, { displayName: data.name, snapshotPrice: data.price ?? 0, currentPrice: data.price ?? null, pct: 0, imageUrl: data.imageUrl ?? null })
        return next
      })
      fetch('/api/wishlist').then(r => r.json()).then(d => { if (Array.isArray(d)) setSingles(d) })
    }
    setAddLoading(false)
  }

  async function resetStaleBaselines() {
    const staleRows = rows.filter(r => (r.pct ?? 0) < -0.05 && isStaleLoser(r) && r.currentPrice != null)
    if (!staleRows.length) return
    setStaleResetLoading(true)
    await Promise.all(staleRows.map(row =>
      fetch('/api/wishlist/snapshot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.displayName, snapshotPrice: row.currentPrice }),
      })
    ))
    setSingles(prev => prev.map(s => {
      const match = staleRows.find(r => r.displayName === s.name)
      return match ? { ...s, snapshotPrice: match.currentPrice! } : s
    }))
    setResults(prev => {
      const next = new Map(prev)
      staleRows.forEach(r => {
        const existing = next.get(r.displayName)
        if (existing) next.set(r.displayName, { ...existing, pct: 0, snapshotPrice: r.currentPrice! })
      })
      return next
    })
    staleRows.forEach(r => staleResetRef.current.add(r.displayName))
    setStaleResetLoading(false)
  }

  async function deleteCard(name: string) {
    await fetch('/api/wishlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSingles(prev => prev.filter(s => s.name !== name))
    setResults(prev => { const next = new Map(prev); next.delete(name); return next })
  }

  async function moveToBinder(name: string) {
    const res = await fetch('/api/wishlist/move-to-binder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setSingles(prev => prev.filter(s => s.name !== name))
      setResults(prev => { const next = new Map(prev); next.delete(name); return next })
    }
  }

  const rows: CardResult[] = singles.map(s =>
    results.get(s.name) ?? { displayName: s.name, snapshotPrice: s.snapshotPrice ?? 0, currentPrice: null, pct: null, imageUrl: null, note: s.note }
  )

  const STALE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000
  const STALE_RESET_WINDOW_MS = 4 * 24 * 60 * 60 * 1000
  const STALE_MOVE_PCT = 2

  function isStaleLoser(row: CardResult): boolean {
    if (row.currentPrice == null) return false
    const history = wishlistHistory[row.displayName] ?? []
    const windowStart = Date.now() - STALE_WINDOW_MS
    const recent = history.filter(h => new Date(h.date).getTime() >= windowStart)
    if (recent.length === 0) return false
    const oldest = recent[0].price
    if (oldest <= 0) return false
    return Math.abs((row.currentPrice - oldest) / oldest) * 100 < STALE_MOVE_PCT
  }

  function isStaleFor4Days(row: CardResult): boolean {
    if (row.currentPrice == null) return false
    const history = wishlistHistory[row.displayName] ?? []
    const windowStart = Date.now() - STALE_RESET_WINDOW_MS
    const recent = history.filter(h => new Date(h.date).getTime() >= windowStart)
    if (recent.length < 2) return false
    const earliest = new Date(recent[0].date).getTime()
    if (Date.now() - earliest < STALE_RESET_WINDOW_MS * 0.75) return false
    const oldest = recent[0].price
    if (oldest <= 0) return false
    return Math.abs((row.currentPrice - oldest) / oldest) * 100 < STALE_MOVE_PCT
  }

  const staleRows = rows.filter(r => (r.pct ?? 0) < -0.05 && isStaleLoser(r) && r.currentPrice != null)
  const gainers = rows.filter(r => (r.pct ?? 0) > 0.05)
  const losers = rows.filter(r => (r.pct ?? 0) < -0.05 && !isStaleLoser(r) && !isWishlistCardDismissed(r.displayName, r.currentPrice))
  const flat = rows.filter(r => r.pct !== null && (Math.abs(r.pct) <= 0.05 || ((r.pct ?? 0) < -0.05 && (isStaleLoser(r) || isWishlistCardDismissed(r.displayName, r.currentPrice)))))
  const pending = rows.filter(r => r.pct === null)
  const buySuggestions = rows.filter(r => r.pct !== null && r.pct <= BUY_THRESHOLD && !isStaleLoser(r) && !isWishlistCardDismissed(r.displayName, r.currentPrice))
  const sealedBuySuggestions = Array.from(sealedResults.values()).filter(r => r.pct !== null && r.pct <= -10)
  const ATL_WINDOW_MS = 24 * 60 * 60 * 1000
  const atlCutoff = Date.now() - ATL_WINDOW_MS

  const ATL_MIN_DELTA = 2

  function isAtlPrice(currentPrice: number | null | undefined, productId: number, snapshotPrice: number, targetPrice?: number | null) {
    if (currentPrice == null) return false
    if (targetPrice != null && currentPrice <= targetPrice) return true
    const older = (sealedHistory[productId] ?? []).filter(h => new Date(h.date).getTime() < atlCutoff)
    const baseline = older.length > 0 ? Math.min(...older.map(h => h.price), snapshotPrice) : snapshotPrice
    return baseline - currentPrice >= ATL_MIN_DELTA
  }

  const atlSealedItems = sealedItems.filter(item => {
    const currentPrice = sealedResults.get(item.id)?.currentPrice
    return isAtlPrice(currentPrice, item.tcgProductId, item.snapshotPrice, item.targetPrice)
  })
  const totalValue = rows.reduce((sum, r) => sum + (r.currentPrice ?? r.snapshotPrice), 0)
  const totalSnapshot = rows.reduce((sum, r) => sum + r.snapshotPrice, 0)
  const totalDelta = results.size > 0 ? totalValue - totalSnapshot : null

  const sealedResultsList = Array.from(sealedResults.values())
  const sealedGainers = sealedResultsList.filter(r => (r.pct ?? 0) > 0.05)
  const sealedLosers = sealedResultsList.filter(r => (r.pct ?? 0) < -0.05)
  const sealedTotalValue = sealedItems.reduce((sum, item) => {
    const r = sealedResults.get(item.id)
    return sum + (r?.currentPrice ?? item.snapshotPrice)
  }, 0)
  const sealedTotalSnapshot = sealedItems.reduce((sum, item) => sum + item.snapshotPrice, 0)
  const sealedTotalDelta = sealedResults.size > 0 ? sealedTotalValue - sealedTotalSnapshot : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Wishlist</h1>
          <p className="text-sm text-stone-500 mt-1">{singles.length} / 100 cards · {sealedItems.length} / 50 sealed</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
          {streaming
            ? <span className="text-xs px-2.5 py-1 rounded-lg border border-stone-800 text-stone-500">Refreshing… {progress}/{total}</span>
            : <button
                onClick={() => startStream(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-colors"
              >
                ↻ Refresh
              </button>
          }
          {staleRows.length > 0 && !streaming && (
            <button
              onClick={() => resetStaleBaselines()}
              disabled={staleResetLoading}
              className="text-xs px-2.5 py-1 rounded-lg border border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-500 transition-colors shrink-0 disabled:opacity-50"
            >
              {staleResetLoading ? 'Resetting…' : `Reset ${staleRows.length} stale cards`}
            </button>
          )}
        </div>
      </div>

      {/* Add inputs */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex gap-1 bg-stone-900 border border-stone-700 rounded-lg p-1 w-fit">
          <button
            onClick={() => setAddMode('single')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${addMode === 'single' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Singles
          </button>
          <button
            onClick={() => setAddMode('sealed')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${addMode === 'sealed' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Sealed product
          </button>
        </div>
      {addMode === 'single' && <div className="relative" ref={addDropdownRef}>
        <div className="flex gap-2">
          <input
            value={addQuery}
            onChange={e => handleAddInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !showDropdown) addCard(); if (e.key === 'Escape') setShowDropdown(false) }}
            onFocus={() => addCandidates.length > 0 && setShowDropdown(true)}
            placeholder="Add a card to wishlist..."
            className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-4 py-2.5 text-base sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
          />
        </div>
        {showDropdown && addCandidates.length > 0 && (
          <div className="absolute z-40 top-full left-0 right-12 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl">
            {addCandidates.map(c => (
              <button
                key={`${c.name}-${c.setCode}`}
                onMouseDown={e => { e.preventDefault(); selectNameForPrinting(c.name) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800 transition-colors border-b border-stone-800 last:border-0 text-left"
              >
                <div>
                  <p className="text-stone-200 text-sm font-medium truncate min-w-0">{c.name}</p>
                  <p className="text-stone-500 text-xs">{c.type_line}</p>
                </div>
                {c.price && <span className="text-green-400 font-mono text-sm ml-4">${c.price.toFixed(2)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      }
      {addMode === 'sealed' && <div id="wishlist-sealed-add" className="relative" ref={sealedDropdownRef}>
        <input
          value={sealedQuery}
          onChange={e => { setSealedQuery(e.target.value); setSealedShowDropdown(true) }}
          onFocus={() => { loadSealedGroups(); setSealedShowDropdown(true) }}
          onKeyDown={e => { if (e.key === 'Escape') { setSealedShowDropdown(false); setSealedQuery('') } }}
          placeholder="Search sets to add sealed product…"
          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-2.5 text-base sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
        />
        {sealedShowDropdown && (
          <div id="wishlist-sealed-dropdown" className="absolute z-40 top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl max-h-72 overflow-y-auto">
            {!sealedGroupsLoaded ? (
              <p className="text-stone-600 text-sm px-4 py-3">Loading sets…</p>
            ) : (() => {
              const filtered = sealedQuery.trim()
                ? sealedGroups.filter(g => g.name.toLowerCase().includes(sealedQuery.toLowerCase()))
                : sealedGroups.slice(0, 30)
              return filtered.length === 0 ? (
                <p className="text-stone-600 text-sm px-4 py-3">No sets found</p>
              ) : filtered.map(g => (
                <button
                  key={g.groupId}
                  onMouseDown={e => { e.preventDefault(); selectSealedGroup(g) }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800 border-b border-stone-800 last:border-0 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-stone-200 text-sm truncate">{g.name}</p>
                    {g.abbreviation && <p className="text-stone-600 text-xs">{g.abbreviation.toUpperCase()}</p>}
                  </div>
                  <span className="text-stone-600 text-xs shrink-0">{new Date(g.publishedOn).getFullYear()}</span>
                </button>
              ))
            })()}
          </div>
        )}
      </div>}

      </div>

      {/* Printing picker modal */}
      {printingModalOpen && addPrintingName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) { setPrintingModalOpen(false); setAddPrintings([]); setAddPrintingName(null) } }}
          onKeyDown={e => { if (e.key === 'Escape') { setPrintingModalOpen(false); setAddPrintings([]); setAddPrintingName(null) } }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
              <h2 className="text-stone-100 font-semibold truncate pr-4">{addPrintingName} — choose printing</h2>
              <button
                onClick={() => { setPrintingModalOpen(false); setAddPrintings([]); setAddPrintingName(null) }}
                className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none shrink-0"
              >✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {addPrintings.length === 0 ? (
                <p className="text-stone-600 text-sm">Loading printings…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {addPrintings.map(c => (
                    <button
                      key={`${c.name}-${c.setCode}-${c.collectorNumber}`}
                      onClick={() => addCard(c.name, c.setCode, c.scryfallId)}
                      className="flex flex-col w-full rounded-xl border border-stone-700 hover:border-amber-600 transition-colors overflow-hidden text-left group"
                    >
                      <CardImage src={c.imageUrl} alt={c.name} className="w-full" />
                      <div className="px-2 py-1.5 bg-stone-800 w-full flex-1 flex flex-col gap-0.5">
                        <p className="text-xs text-stone-300 font-medium">{c.setName}</p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs text-stone-600 font-mono">{c.setCode.toUpperCase()}</span>
                          {c.rarity && (
                            <span className={`text-xs capitalize shrink-0 ${
                              c.rarity === 'mythic' ? 'text-orange-400' :
                              c.rarity === 'rare' ? 'text-yellow-400' :
                              c.rarity === 'uncommon' ? 'text-blue-400' : 'text-stone-500'
                            }`}>{c.rarity}</span>
                          )}
                        </div>
                        {c.price != null && <span className="text-xs font-mono text-stone-400">${c.price.toFixed(2)}</span>}
                        {c.foilPrice != null && <span className="text-xs font-mono text-amber-500">${c.foilPrice.toFixed(2)} foil</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sealed product modal */}
      {sealedModalOpen && sealedSelectedGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) closeSealedModal() }}
          onKeyDown={e => { if (e.key === 'Escape') closeSealedModal() }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
              <h2 className="text-stone-100 font-semibold truncate pr-4">{sealedSelectedGroup.name}</h2>
              <button onClick={closeSealedModal} className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none shrink-0">✕</button>
            </div>
            {sealedAddError && (
              <p className="mx-4 mt-3 text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 shrink-0">{sealedAddError}</p>
            )}
            <div className="flex-1 overflow-y-auto">
              {sealedProductsLoading ? (
                <p className="text-stone-600 text-sm px-5 py-4">Loading products…</p>
              ) : sealedProducts.length === 0 ? (
                <p className="text-stone-600 text-sm px-5 py-4">No sealed products found</p>
              ) : sealedProducts.map(p => {
                const suffix = p.name.includes(' - ') ? p.name.slice(p.name.indexOf(' - ') + 3) : p.name
                const alreadyAdded = sealedItems.some(s => s.tcgProductId === p.productId)
                const isSelected = pendingSealedProduct?.productId === p.productId
                return (
                  <div
                    key={p.productId}
                    className={`border-b border-stone-800 last:border-0 transition-colors ${isSelected ? 'bg-stone-800' : ''}`}
                  >
                    <button
                      onClick={() => {
                        if (alreadyAdded) return
                        setPendingSealedProduct(isSelected ? null : p)
                        setPendingTargetPrice('')
                        setSealedAddError('')
                      }}
                      disabled={alreadyAdded}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-800 text-left transition-colors disabled:opacity-40"
                    >
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="w-14 h-14 object-contain rounded shrink-0" />
                        : <div className="w-14 h-14 bg-stone-700 rounded shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-200 text-sm font-medium leading-snug">{suffix}</p>
                        {p.price != null
                          ? <p className="text-green-400 font-mono text-sm mt-0.5">${p.price.toFixed(2)}</p>
                          : <p className="text-stone-600 font-mono text-sm mt-0.5">—</p>}
                      </div>
                      <span className={`text-xs shrink-0 ${alreadyAdded ? 'text-stone-600' : isSelected ? 'text-amber-400' : 'text-stone-500'}`}>
                        {alreadyAdded ? 'Added' : isSelected ? '▲ selected' : '+ Add'}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="flex items-center gap-2 px-4 pb-3">
                        <span className="text-stone-500 text-xs">Alert below $</span>
                        <input
                          autoFocus
                          type="number"
                          step="0.01"
                          placeholder="optional"
                          value={pendingTargetPrice}
                          onChange={e => setPendingTargetPrice(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmSealedAdd() }}
                          className="w-24 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-base sm:text-sm text-stone-100 focus:outline-none focus:border-amber-600"
                        />
                        <button
                          onClick={confirmSealedAdd}
                          disabled={!!sealedAdding}
                          className="px-3 py-1.5 bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                        >
                          {sealedAdding ? 'Adding…' : 'Add to Wishlist'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {addStatus && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          addStatus.type === 'success'
            ? 'bg-green-900/30 border border-green-800 text-green-300'
            : 'bg-red-900/30 border border-red-800 text-red-300'
        }`}>
          {addStatus.message}
        </div>
      )}

      {streaming && (
        <div className="mb-6 bg-stone-800 rounded-full overflow-hidden h-1.5">
          <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: total ? `${(progress / total) * 100}%` : '0%' }} />
        </div>
      )}

      {/* Buy Opportunities — merged ATL + Good Time to Buy */}
      {(() => {
        const visibleAtl = atlSealedItems.filter(item => !isSealedDismissed(item.tcgProductId, sealedResults.get(item.id)?.currentPrice ?? Infinity))
        const visibleBuy = buySuggestions

        if (visibleAtl.length === 0 && visibleBuy.length === 0) return null

        return (
          <div className="mb-6 bg-stone-900 border border-stone-800 rounded-xl p-4">
            <p className="text-stone-300 font-semibold text-sm mb-3">Buy Opportunities</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">

              {visibleAtl.map(item => {
                const name = item.productName.includes(' - ') ? item.productName.slice(item.productName.indexOf(' - ') + 3) : item.productName
                const currentPrice = sealedResults.get(item.id)?.currentPrice
                const pct = currentPrice != null && item.snapshotPrice > 0 ? (currentPrice - item.snapshotPrice) / item.snapshotPrice : null
                const saved = currentPrice != null ? item.snapshotPrice - currentPrice : null
                return (
                  <div key={item.id} className="group relative bg-green-950/30 border border-green-800/50 rounded-lg px-3 py-2 overflow-hidden">
                    <div className="flex items-center gap-2 mb-0.5 min-w-0">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-900/80 text-green-300 shrink-0">↓ ATL</span>
                      <p className="text-stone-200 text-sm font-medium truncate min-w-0">{item.setName} — {name}</p>
                    </div>
                    {currentPrice != null && (
                      <p className="text-green-400 text-[10px] sm:text-xs font-mono">
                        ${item.snapshotPrice.toFixed(2)} → ${currentPrice.toFixed(2)} ({pctLabel(pct)})
                        {saved != null && <span className="hidden sm:inline ml-1 text-green-500">−${saved.toFixed(2)}</span>}
                      </p>
                    )}
                    {currentPrice != null && (
                      <button onClick={() => dismissSealed(item.tcgProductId, currentPrice)} className="mt-1.5 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 transition-colors">Dismiss</button>
                    )}
                  </div>
                )
              })}


              {visibleBuy.map(r => {
                const saved = r.currentPrice != null ? r.snapshotPrice - r.currentPrice : null
                return (
                  <div key={r.displayName} className="group relative bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2 overflow-hidden">
                    <div className="flex items-center gap-2 mb-0.5 min-w-0">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-900/80 text-amber-300 shrink-0">↓ {Math.abs(BUY_THRESHOLD)}%+</span>
                      <p className="text-stone-200 text-sm font-medium truncate min-w-0">{r.displayName}</p>
                    </div>
                    <p className="text-amber-400 text-[10px] sm:text-xs font-mono">
                      ${r.snapshotPrice.toFixed(2)} → ${r.currentPrice?.toFixed(2)} ({pctLabel(r.pct)})
                      {saved != null && <span className="hidden sm:inline ml-1 text-amber-500">−${saved.toFixed(2)}</span>}
                    </p>
                    {r.currentPrice != null && (
                      <button onClick={() => dismissWishlistCard(r.displayName, r.currentPrice!)} className="mt-1.5 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-900/50 hover:border-red-700 text-red-400 hover:text-red-300 transition-colors">Dismiss</button>
                    )}
                  </div>
                )
              })}


            </div>
          </div>
        )
      })()}

      {/* Sealed Products */}
      <div id="wishlist-sealed" className="flex flex-col gap-4 mb-8">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSealedOpen(o => !o)}
            className="flex-1 min-w-0 flex items-center gap-2 text-left"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-stone-300 font-semibold">Sealed Products</h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {sealedItems.length} {sealedItems.length === 1 ? 'product' : 'products'} tracked
                {sealedStreaming && ` · loading ${sealedProgress}/${sealedTotal}`}
                {!sealedStreaming && (() => {
                  const allDates = Object.values(sealedHistory).flat().map(e => e.date)
                  const historyDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : null
                  const reference = [historyDate, sealedLastRun].filter(Boolean).reduce<Date | null>((a, b) => (a && b ? (a > b ? a : b) : a ?? b), null)
                  if (!reference) return null
                  const mins = Math.floor((Date.now() - reference.getTime()) / 60000)
                  const label = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
                  return ` · updated ${label}`
                })()}
              </p>
            </div>
            <span className="text-stone-400 text-sm shrink-0">{sealedOpen ? '▲' : '▼'}</span>
          </button>
          {sealedTotalValue > 0 && (
            <span className="flex items-center gap-2 font-mono text-sm shrink-0">
              <span className={`font-semibold ${sealedTotalDelta == null ? 'text-stone-100' : sealedTotalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ~${sealedTotalValue.toFixed(2)}
              </span>
              {sealedTotalDelta != null && sealedTotalDelta !== 0 && (
                <span className={`text-xs ${sealedTotalDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {sealedTotalDelta > 0 ? '+' : ''}${sealedTotalDelta.toFixed(2)}
                </span>
              )}
            </span>
          )}
        </div>

        {sealedStreaming && (
          <div className="bg-stone-800 rounded-full overflow-hidden h-1">
            <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: sealedTotal ? `${(sealedProgress / sealedTotal) * 100}%` : '0%' }} />
          </div>
        )}

        {sealedOpen && (
          sealedItems.length > 0 ? (
            <>
            <div id="wishlist-sealed-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-3">
              {sealedItems.map(item => {
                const result = sealedResults.get(item.id)
                const display: SealedResult = result ?? {
                  id: item.id,
                  productId: item.tcgProductId,
                  productName: item.productName,
                  setName: item.setName,
                  snapshotPrice: item.snapshotPrice,
                  currentPrice: null,
                  pct: null,
                  imageUrl: item.imageUrl,
                }
                const history = sealedHistory[item.tcgProductId]?.map(h => h.price) ?? []
                const isAtl = isAtlPrice(display.currentPrice, item.tcgProductId, item.snapshotPrice, item.targetPrice)
                const sparkline = history.length > 0 ? history : undefined
                return <SealedProductTile key={item.id} item={display} onDelete={deleteSealedItem} sparkline={sparkline} isAtl={isAtl} targetPrice={item.targetPrice} onSetTargetPrice={updateSealedTargetPrice} />
              })}
            </div>
            </>
          ) : (
            <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-8 text-center">
              <p className="text-stone-500 text-sm">No sealed products on your watchlist</p>
              <p className="text-xs text-stone-600 mt-1">Track booster boxes, bundles, and more</p>
            </div>
          )
        )}
      </div>

      {rows.length > 0 && (
        <div id="wishlist-cards" className="flex flex-col gap-4 mb-8">
          <button
            onClick={() => setCardsOpen(o => !o)}
            className="flex items-center gap-2 text-left"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-stone-300 font-semibold">Singles</h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {rows.length} {rows.length === 1 ? 'card' : 'cards'} tracked
                {results.size > 0 && ` · ${gainers.length} up · ${losers.length} down · ${flat.length} flat`}
                {pending.length > 0 && ` · ${pending.length} pending`}
                {updatedAt && ` · updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <span className="text-stone-400 text-sm shrink-0">{cardsOpen ? '▲' : '▼'}</span>
            {totalValue > 0 && (
              <span className="flex items-center gap-2 font-mono text-sm shrink-0">
                <span className={`font-semibold ${totalDelta == null ? 'text-stone-100' : totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ~${totalValue.toFixed(2)}
                </span>
                {totalDelta != null && totalDelta !== 0 && (
                  <span className={`text-xs ${totalDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalDelta > 0 ? '+' : ''}${totalDelta.toFixed(2)}
                  </span>
                )}
              </span>
            )}
          </button>
          {cardsOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-3">
              {[...rows].sort((a, b) => (a.pct ?? 1) - (b.pct ?? 1)).map(row => (
                <WishlistCard key={row.displayName} row={row} onDelete={deleteCard} onMoveToBinder={moveToBinder} sparkline={wishlistHistory[row.displayName]?.map(h => h.price)} isStale={isStaleLoser(row) && (row.pct ?? 0) < -0.05} />
              ))}
            </div>
          )}
        </div>
      )}

      {singles.length === 0 && !streaming && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-stone-400 font-semibold">Your wishlist is empty</p>
          <p className="text-sm text-stone-600">Search for a card above to add it and track price drops.</p>
        </div>
      )}
    </div>
  )
}
