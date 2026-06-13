'use client'

import { useState, useEffect, useRef } from 'react'
import CollectionChart from '@/components/CollectionChart'
import type { FoilType } from '@/lib/scryfall'

interface BinderEntry {
  id: string
  displayName: string
  baseName: string
  setCode: string
  scryfallId: string | null
  foilType: FoilType
  count: number
  snapshotPrice: number
  addedPrice: number | null
  purchasePrice: number | null
  condition: string | null
  note: string | null
  dateAdded: string | null
}

interface CardResult {
  displayName: string
  snapshotPrice: number
  purchasePrice?: number | null
  condition?: string | null
  currentPrice: number | null
  pct: number | null
  dailyPct: number | null
  dailyBaseline: number | null
  dailyDaysAgo?: number | null
  imageUrl: string | null
  backImageUrl?: string | null
  fromCache?: boolean
  note?: string
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
  foilType?: FoilType
  rowKey?: string
}

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'Damaged'] as const
const CONDITION_COLOR: Record<string, string> = {
  'NM': 'bg-green-900/80 text-green-300',
  'LP': 'bg-yellow-900/80 text-yellow-300',
  'MP': 'bg-orange-900/80 text-orange-300',
  'HP': 'bg-red-900/80 text-red-400',
  'Damaged': 'bg-red-950/90 text-red-500',
}
type Condition = typeof CONDITIONS[number]
type Candidate = { scryfallId?: string; name: string; setCode: string; setName: string; price: number | null; foilPrice?: number | null; etchedPrice?: number | null; type_line: string; collectorNumber?: string; rarity?: string; releasedAt?: string; imageUrl?: string | null }

function makeRowKey(displayName: string, setCode: string | null | undefined, foilType: FoilType): string {
  return `${displayName}||${setCode ?? ''}||${foilType}`
}


const LS_BINDER_ENTRIES = 'tnk:binder:entries'
const LS_BINDER_RESULTS = 'tnk:binder:results'
const LS_BINDER_HISTORY = 'tnk:binder:history'
const LS_BINDER_CARD_HISTORY = 'tnk:binder:card-history'
const LS_HIGHLIGHTS = 'tnk:highlights'
const LS_HISTORY = 'tnk:history'
const LS_CACHE_VERSION = 'tnk:cache:version'
const CACHE_VERSION = '3'
const LS_STREAM_AT = 'tnk:binder:stream-at'
const STREAM_TTL = 4 * 60 * 60 * 1000

function pctColor(pct: number | null, purchasePrice?: number | null) {
  if (pct !== null && pct < -0.05) return 'text-red-400'
  if (purchasePrice === 0) return 'text-green-400'
  if (pct === null) return 'text-stone-500'
  if (pct > 0.05) return 'text-green-400'
  return 'text-stone-400'
}

function pctLabel(pct: number | null, currentPrice?: number | null, purchasePrice?: number | null) {
  if (purchasePrice === 0) {
    if (currentPrice == null) return '—'
    return `+$${currentPrice.toFixed(2)}`
  }
  if (pct === null) return '—'
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : ''
  return `${arrow}${Math.abs(pct).toFixed(1)}%`
}

function dailyPctLabel(dailyPct: number | null, daysAgo?: number | null) {
  if (dailyPct === null) return null
  const arrow = dailyPct > 0 ? '▲' : dailyPct < 0 ? '▼' : ''
  const timeLabel = !daysAgo || daysAgo <= 1 ? 'today' : `${daysAgo}d ago`
  return <>{arrow}{Math.abs(dailyPct).toFixed(1)}% <span className="text-xs font-normal">{timeLabel}</span></>
}

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

function Sparkline({ values, width = 72, height = 22, fullWidth = false, dates, showLabels = false, counts, labelsOnMobile = false, labelFontSize = 7 }: {
  values: number[]
  width?: number
  height?: number
  fullWidth?: boolean
  dates?: string[]
  showLabels?: boolean
  counts?: (number | null)[]
  labelsOnMobile?: boolean
  labelFontSize?: number
}) {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padLeft = showLabels ? 36 : 1.5
  const padRight = showLabels ? 8 : 1.5
  const padY = showLabels ? 16 : 1.5
  const padBottom = showLabels ? 16 : 1.5
  const parseTs = (d: string) => new Date(d.length === 13 ? d + ':00:00Z' : d).getTime()
  const firstTs = dates && dates.length > 1 ? parseTs(dates[0]) : 0
  const lastTs = dates && dates.length > 1 ? parseTs(dates[dates.length - 1]) : 0
  const x = (i: number) => {
    if (dates && dates.length > 1 && lastTs !== firstTs) {
      const t = parseTs(dates[i])
      return padLeft + ((t - firstTs) / (lastTs - firstTs)) * (width - padLeft - padRight)
    }
    return padLeft + (values.length > 1 ? (i / (values.length - 1)) : 0) * (width - padLeft - padRight)
  }
  const y = (v: number) => padY + (1 - (v - min) / range) * (height - padY - padBottom)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const trend = values[values.length - 1] - values[0]
  const color = trend > 0 ? '#4ade80' : trend < 0 ? '#f87171' : '#6b7280'
  const gradId = `binderGrad-${width}-${height}`
  const area = `M${x(0).toFixed(1)},${height - padBottom} ` +
    values.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') +
    ` L${x(values.length - 1).toFixed(1)},${height - padBottom} Z`
  const yLabels = showLabels ? [min, (min + max) / 2, max] : []
  const xIndices = (showLabels && dates)
    ? (values.length <= 5 ? values.map((_, i) => i) : [0, Math.floor(values.length / 3), Math.floor(2 * values.length / 3), values.length - 1])
    : []

  // Event markers: vertical lines where card count changed, grouped by date
  const countByDate = new Map<string, { x: number; delta: number }>()
  if (counts && dates) {
    for (let k = 1; k < counts.length; k++) {
      if (counts[k] != null && counts[k - 1] != null && counts[k] !== counts[k - 1]) {
        const date = dates[k].slice(0, 10)
        const delta = (counts[k] as number) - (counts[k - 1] as number)
        const existing = countByDate.get(date)
        if (existing) {
          existing.delta += delta
          existing.x = x(k)
        } else {
          countByDate.set(date, { x: x(k), delta })
        }
      }
    }
  }
  const countMarkers = [...countByDate.values()].filter(m => m.delta !== 0)

  return (
    <svg
      width={fullWidth ? '100%' : width}
      height={fullWidth ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      className={fullWidth ? 'w-full' : 'opacity-70 shrink-0'}
    >
      {showLabels && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <g className={labelsOnMobile ? undefined : 'hidden sm:block'}>
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padLeft} y1={y(v)} x2={width - padRight} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={padLeft - 4} y={y(v) + 4} textAnchor="end" fontSize={labelFontSize} fill="#475569">${Math.round(v)}</text>
          </g>
        ))}
        {xIndices.map(i => (
          <text key={i} x={x(i)} y={height - 2} textAnchor="middle" fontSize={labelFontSize} fill="#475569">
            {dates![i].slice(5, 10)}
          </text>
        ))}
      </g>
      <g>
        {countMarkers.map(({ x: cx, delta }, idx) => {
          const isAdd = delta > 0
          const markerColor = isAdd ? '#4ade80' : '#f87171'
          const label = isAdd ? `+${delta}` : `${delta}`
          return (
            <g key={idx}>
              <line x1={cx} y1={padY} x2={cx} y2={height - padBottom} stroke={markerColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <text x={cx} y={padY - 3} textAnchor="middle" fontSize={labelsOnMobile ? "14" : "7"} fontWeight="600" fill={markerColor}>{label}</text>
            </g>
          )
        })}
      </g>
      {showLabels && <path d={area} fill={`url(#${gradId})`} />}
      {values.length > 1
        ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        : <circle cx={x(0)} cy={y(values[0])} r="3" fill={color} />}
    </svg>
  )
}

function SparklinePlaceholder({ height = 100 }: { height?: number }) {
  const mid = height / 2
  return (
    <svg width="100%" height={height} viewBox={`0 0 200 ${height}`} preserveAspectRatio="none" className="w-full opacity-60">
      <polyline points={`0,${mid} 200,${mid}`} fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function EditModal({ row, onClose, isNew = false, onAdded, onSaved }: { row: CardResult; onClose: () => void; isNew?: boolean; onAdded?: () => void; onSaved?: () => void }) {
  const [editPrints, setEditPrints] = useState<Candidate[]>([])
  const [editPrintsLoading, setEditPrintsLoading] = useState(true)
  const [editFoilType, setEditFoilType] = useState<FoilType>(row.foilType ?? 'none')
  const [editCondition, setEditCondition] = useState<string>(row.condition ?? 'NM')
  const [editPurchasePrice, setEditPurchasePrice] = useState(row.purchasePrice != null ? String(row.purchasePrice) : '')
  const [editNote, setEditNote] = useState(row.note ?? '')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    const baseName = row.displayName
      .replace(/\s*\/\/.*$/, '')
      .replace(/\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i, '')
      .trim()
    fetch(`/api/card?q=${encodeURIComponent(baseName)}&prints=true`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setEditPrints(data) })
      .finally(() => setEditPrintsLoading(false))
  }, [row.displayName])

  async function saveEdit(scryfallId?: string, setCode?: string) {
    setEditSaving(true)
    const purchasePrice = editPurchasePrice.trim() === '' ? null : parseFloat(editPurchasePrice)
    const res = await fetch('/api/binder/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: row.displayName, scryfallId, setCode, foilType: editFoilType, purchasePrice, condition: editCondition, note: editNote.trim() || null }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Failed to save: ${data.error ?? res.statusText}`)
      return
    }
    onClose()
    onSaved?.()
  }

  async function addNew(scryfallId?: string, setCode?: string) {
    setEditSaving(true)
    const purchasePrice = editPurchasePrice.trim() === '' ? null : parseFloat(editPurchasePrice)
    const res = await fetch('/api/binder/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: row.displayName, scryfallId, setCode, foilType: editFoilType, purchasePrice, condition: editCondition, note: editNote.trim() || null }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Failed to add: ${data.error ?? res.statusText}`)
      return
    }
    onClose()
    onAdded?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg md:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <div>
            <p className="font-semibold text-stone-100">{row.displayName}</p>
            <p className="text-xs text-stone-500">{row.setCode?.toUpperCase()} · {row.foilType === 'etched' ? 'Etched foil' : row.foilType === 'foil' ? 'Foil' : 'Non-foil'}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-stone-500 uppercase tracking-wider">Condition</span>
              <div className="flex flex-wrap gap-1">
                {CONDITIONS.map(c => (
                  <button key={c} onClick={() => setEditCondition(c)} className={`text-xs px-2.5 py-1 rounded border transition-colors ${editCondition === c ? 'border-amber-600 text-amber-400 bg-amber-950/40' : 'border-stone-700 text-stone-500 hover:border-stone-500'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-stone-500 uppercase tracking-wider">Foil</span>
              <div className="flex gap-1.5">
                {(['none', 'foil', 'etched'] as FoilType[]).map(ft => (
                  <button key={ft} onClick={() => setEditFoilType(ft)} className={`text-xs px-2.5 py-1 rounded border transition-colors ${editFoilType === ft ? 'border-amber-600 text-amber-400 bg-amber-950/40' : 'border-stone-700 text-stone-500 hover:border-stone-500'}`}>
                    {ft === 'none' ? 'Non-foil' : ft === 'foil' ? 'Foil' : 'Etched'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <span className="text-xs text-stone-500 uppercase tracking-wider">Purchase price</span>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 text-sm shrink-0">$</span>
                <input type="number" min="0" step="0.01" placeholder="Scryfall price" value={editPurchasePrice} onChange={e => setEditPurchasePrice(e.target.value)} className="min-w-0 flex-1 bg-stone-950 border border-stone-700 rounded px-2 py-1 text-base sm:text-sm text-stone-200 font-mono placeholder-stone-600 focus:outline-none focus:border-amber-600" />
                <button onClick={() => setEditPurchasePrice('0')} className="text-xs px-2 py-1 rounded border border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-300 transition-colors whitespace-nowrap shrink-0">Booster pull</button>
              </div>
              {editPurchasePrice === '0' && <p className="text-xs text-stone-600">Shows dollar gain instead of %</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-500 uppercase tracking-wider">Note</span>
            <input
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              placeholder="Optional note"
              className="bg-stone-950 border border-stone-700 rounded px-3 py-2 text-base sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-stone-500 uppercase tracking-wider">Select a printing</span>
            {editPrintsLoading ? (
              <p className="text-sm text-stone-600">Loading printings…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {editPrints.map(p => (
                  <button key={p.scryfallId ?? p.setCode} onClick={() => isNew ? addNew(p.scryfallId, p.setCode) : saveEdit(p.scryfallId, p.setCode)} disabled={editSaving} className="flex flex-col w-full rounded-xl border border-stone-700 hover:border-amber-600 transition-colors overflow-hidden text-left group disabled:opacity-50">
                    <CardImage src={p.imageUrl} alt={p.name} className="w-full" />
                    <div className="px-2 py-1.5 bg-stone-800 w-full flex-1">
                      <p className="text-xs text-stone-300 font-medium">{p.setName}</p>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-stone-600 font-mono">{p.setCode.toUpperCase()}</span>
                        <span className="text-xs font-mono text-stone-400 shrink-0">{editFoilType === 'etched' && p.etchedPrice != null ? `$${p.etchedPrice.toFixed(2)}` : editFoilType === 'foil' && p.foilPrice != null ? `$${p.foilPrice.toFixed(2)}` : p.price != null ? `$${p.price.toFixed(2)}` : '—'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-stone-800">
          <button onClick={onClose} className="text-sm px-4 py-1.5 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors">Cancel</button>
          <button onClick={() => isNew ? addNew() : saveEdit()} disabled={editSaving} className="text-sm px-4 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50">{editSaving ? (isNew ? 'Adding…' : 'Saving…') : (isNew ? 'Add to binder' : 'Save')}</button>
        </div>
      </div>
    </div>
  )
}

function CompactCard({ row, onDelete, onEdit, pendingDelete, sparkline, expanded, onToggleExpand }: {
  row: CardResult
  onDelete: (name: string, rowKey: string) => void
  onEdit: (row: CardResult) => void
  pendingDelete: string | null
  sparkline?: { values: number[], dates: string[] }
  expanded: boolean
  onToggleExpand: () => void
}) {
  const [noteVal, setNoteVal] = useState(row.note ?? '')
  const [savedNote, setSavedNote] = useState(row.note ?? '')
  const [flipped, setFlipped] = useState(false)
  const manapoolSlug = row.displayName.replace(/\s*\/\/.*$/, '').replace(/\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  function commitNote() {
    const trimmed = noteVal.trim()
    if (trimmed === savedNote) return
    setSavedNote(trimmed)
    fetch('/api/binder/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: row.displayName, note: trimmed }),
    })
  }

  return (
    <div className="bg-stone-900 flex flex-col" style={row.foilType && row.foilType !== 'none' ? { background: 'linear-gradient(110deg, #1c1917 15%, rgba(167, 139, 250, 0.12) 35%, rgba(96, 165, 250, 0.11) 52%, rgba(52, 211, 153, 0.10) 68%, #1c1917 85%)' } : undefined}>
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-stone-800/60 transition-colors" onClick={onToggleExpand}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm text-stone-300 truncate">{row.displayName}</span>
          {row.foilType && row.foilType !== 'none' && <span className="text-xs px-1 py-0.5 rounded bg-amber-950/60 text-amber-500 font-mono border border-amber-900/40 shrink-0">{row.foilType}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm text-stone-500 font-mono">${(row.currentPrice ?? row.snapshotPrice).toFixed(2)}</span>
          <span className="text-stone-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-2 flex gap-3 border-t border-stone-800">
          <div className="flex gap-2 shrink-0">
            {row.imageUrl && (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.backImageUrl && flipped ? row.backImageUrl : row.imageUrl}
                  alt={row.displayName}
                  className="w-24 rounded-lg shadow-2xl"
                />
                {row.condition && (
                  <span className={`absolute bottom-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-mono leading-none ${CONDITION_COLOR[row.condition] ?? 'bg-black/70 text-stone-300'}`}>{row.condition}</span>
                )}
                {row.backImageUrl && (
                  <button
                    onClick={() => setFlipped(f => !f)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-stone-300 flex items-center justify-center text-xs hover:bg-black/90 transition-colors"
                    title="Flip card"
                  >↺</button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 justify-center">
            <div className="flex gap-1.5">
              <a href={`https://manapool.com/card/${manapoolSlug}`} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded border border-blue-800/60 text-blue-400 hover:border-blue-500 hover:text-blue-300 transition-colors text-center flex-1">MP</a>
              <a href={`https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(row.displayName.replace(/\s*\/\/.*$/, '').trim())}&view=grid`} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded border border-amber-800/60 text-amber-500 hover:border-amber-500 hover:text-amber-300 transition-colors text-center flex-1">TCG</a>
            </div>
            <button onClick={() => onEdit(row)} className="text-xs px-2.5 py-1 rounded border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200 transition-colors">Edit</button>
            <button onClick={() => onDelete(row.displayName, row.rowKey ?? row.displayName)} className={`text-xs px-2.5 py-1 rounded border transition-colors ${pendingDelete === (row.rowKey ?? row.displayName) ? 'border-red-600 text-red-400 bg-red-900/30' : 'border-red-800/50 text-red-400 hover:bg-red-900/30'}`}>
              {pendingDelete === (row.rowKey ?? row.displayName) ? 'Sure?' : 'Remove'}
            </button>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2 justify-between">
            <div className="border border-stone-700/60 rounded-lg p-2 bg-stone-800">
              {sparkline && sparkline.values.length >= 2
                ? <Sparkline values={sparkline.values} dates={sparkline.dates} fullWidth showLabels width={400} height={80} labelFontSize={9} />
                : <SparklinePlaceholder height={80} />}
            </div>
            <input
              value={noteVal}
              onChange={e => setNoteVal(e.target.value)}
              onBlur={commitNote}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                if (e.key === 'Escape') { setNoteVal(savedNote); (e.target as HTMLInputElement).blur() }
              }}
              className="text-base sm:text-sm px-2 py-1.5 rounded bg-stone-800 border border-stone-700 text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors w-full"
              placeholder="Add a note..."
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CompactCardGrid({ rows, onDelete, pendingDelete, sparklines, onSaved }: { rows: CardResult[]; onDelete: (name: string, rowKey: string) => void; pendingDelete: string | null; sparklines?: Map<string, { values: number[], dates: string[] }>; onSaved?: () => void }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<CardResult | null>(null)

  return (
    <div className="bg-stone-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px">
        {rows.map((row, i) => {
          const rKey = `${row.displayName}-${i}`
          return (
            <CompactCard
              key={rKey}
              row={row}
              onDelete={onDelete}
              onEdit={setEditRow}
              pendingDelete={pendingDelete}
              sparkline={sparklines?.get(row.displayName)}
              expanded={expandedKey === rKey}
              onToggleExpand={() => setExpandedKey(k => k === rKey ? null : rKey)}
            />
          )
        })}
      </div>
      {editRow && <EditModal row={editRow} onClose={() => setEditRow(null)} onSaved={onSaved} />}
    </div>
  )
}

function CardRow({
  row,
  onDelete,
  sparkline,
  pendingDelete,
  expanded,
  onToggleExpand,
  rowId,
  onSaved,
}: {
  row: CardResult
  onDelete: (name: string, rowKey: string) => void
  pendingDelete: string | null
  sparkline?: { values: number[], dates: string[] }
  expanded: boolean
  onToggleExpand: () => void
  rowId?: string
  onSaved?: () => void
}) {
  const costBasis = row.purchasePrice != null ? row.purchasePrice : row.snapshotPrice
  const diff = row.currentPrice != null ? row.currentPrice - costBasis : null
  const [noteVal, setNoteVal] = useState(row.note ?? '')
  const [savedNote, setSavedNote] = useState(row.note ?? '')
  const [showEdit, setShowEdit] = useState(false)
  const [flipped, setFlipped] = useState(false)

  function commitNote() {
    const trimmed = noteVal.trim()
    if (trimmed === savedNote) return
    setSavedNote(trimmed)
    fetch('/api/binder/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: row.displayName, note: trimmed }),
    })
  }

  return (
    <>
    <tr
      id={rowId}
      className="group border-b border-stone-800 hover:bg-stone-800/50 transition-colors cursor-pointer"
      style={row.foilType && row.foilType !== 'none' ? { background: 'linear-gradient(110deg, #1c1917 15%, rgba(167, 139, 250, 0.10) 35%, rgba(96, 165, 250, 0.10) 52%, rgba(52, 211, 153, 0.08) 68%, #1c1917 85%)' } : undefined}
      onClick={onToggleExpand}
    >
      <td className="px-2 sm:px-4 py-3 text-stone-200 font-medium max-w-0 w-full">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{row.displayName}</span>
            {row.foilType && row.foilType !== 'none' && (
              <span className="hidden sm:inline text-[10px] px-1 py-px rounded bg-amber-950/60 text-amber-500 font-mono border border-amber-900/40 shrink-0">{row.foilType}</span>
            )}
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell lg:hidden xl:table-cell px-4 py-3.5 text-right text-stone-500 font-mono text-sm">
        {row.purchasePrice === 0 ? 'pull' : row.purchasePrice != null ? `paid $${row.purchasePrice.toFixed(2)}` : `was $${row.snapshotPrice.toFixed(2)}`}
      </td>
      <td className="hidden md:table-cell lg:hidden xl:table-cell px-4 py-3.5 text-right font-mono text-stone-200">
        {row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : '—'}
      </td>
      <td className={`px-1 sm:px-2 py-3.5 text-right font-mono font-semibold whitespace-nowrap ${pctColor(row.dailyPct ?? row.pct, row.purchasePrice)}`}>
        {row.dailyPct != null ? dailyPctLabel(row.dailyPct, row.dailyDaysAgo) : pctLabel(row.pct, row.currentPrice, row.purchasePrice)}
        {row.dailyPct != null && row.pct != null && (
          <p className={`hidden sm:block text-xs font-normal ${pctColor(row.pct, row.purchasePrice)}`}>
            {pctLabel(row.pct, row.currentPrice, row.purchasePrice)} overall
          </p>
        )}
      </td>
      <td className={`px-2 sm:px-4 py-3.5 text-right font-mono whitespace-nowrap ${
        diff != null && diff < 0 && (row.dailyPct ?? 0) > 0 ? 'text-amber-500' :
        diff != null && diff < 0 ? 'text-red-400' :
        diff != null && diff > 0 && (row.dailyPct ?? 0) < 0 ? 'text-amber-500' :
        diff != null && diff > 0 ? 'text-green-400' :
        'text-stone-500'
      }`}>
        {diff != null ? `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` : '—'}
      </td>
    </tr>
    {expanded && (
      <tr className="border-b border-stone-800" style={row.foilType && row.foilType !== 'none' ? { background: 'linear-gradient(110deg, #1c1917 15%, rgba(167, 139, 250, 0.12) 35%, rgba(96, 165, 250, 0.11) 52%, rgba(52, 211, 153, 0.10) 68%, #1c1917 85%)' } : { background: 'rgb(28 25 23 / 0.5)' }}>
        <td colSpan={5} className="px-4 py-4">
          <div className="flex gap-4 items-center">
            <div className="flex gap-2 shrink-0">
              {row.imageUrl && (
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.backImageUrl && flipped ? row.backImageUrl : row.imageUrl}
                    alt={row.displayName}
                    className="w-28 rounded-xl shadow-2xl"
                  />
                  {row.condition && (
                    <span className={`absolute bottom-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded font-mono leading-none ${CONDITION_COLOR[row.condition] ?? 'bg-black/70 text-stone-300'}`}>{row.condition}</span>
                  )}
                  {row.backImageUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFlipped(f => !f) }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-stone-300 flex items-center justify-center text-xs hover:bg-black/90 transition-colors"
                      title="Flip card"
                    >↺</button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex gap-1.5">
                <a
                  href={`https://manapool.com/card/${row.displayName.replace(/\s*\/\/.*$/, '').replace(/\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs px-3 py-1 rounded border border-blue-800/60 text-blue-400 hover:border-blue-500 hover:text-blue-300 transition-colors text-center flex-1"
                >
                  MP
                </a>
                <a
                  href={`https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(row.displayName.replace(/\s*\/\/.*$/, '').trim())}&view=grid`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs px-3 py-1 rounded border border-amber-800/60 text-amber-500 hover:border-amber-500 hover:text-amber-300 transition-colors text-center flex-1"
                >
                  TCG
                </a>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowEdit(true) }}
                className="text-xs px-3 py-1 rounded border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(row.displayName, row.rowKey ?? row.displayName) }}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  pendingDelete === (row.rowKey ?? row.displayName)
                    ? 'border-red-600 text-red-400 bg-red-900/30'
                    : 'border-red-800/50 text-red-400 hover:bg-red-900/30'
                }`}
              >
                {pendingDelete === (row.rowKey ?? row.displayName) ? 'Sure?' : 'Remove'}
              </button>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2 justify-between">
              <div className="md:hidden flex items-baseline gap-2">
                <span className="text-stone-200 font-mono font-semibold">{row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : '—'}</span>
                <span className="text-stone-500 font-mono text-xs">{row.purchasePrice === 0 ? 'pull' : row.purchasePrice != null ? `paid $${row.purchasePrice.toFixed(2)}` : `was $${row.snapshotPrice.toFixed(2)}`}</span>
              </div>
              <div className="border border-stone-700/60 rounded-lg p-2 bg-stone-800">
                {sparkline && sparkline.values.length >= 2
                  ? <Sparkline values={sparkline.values} dates={sparkline.dates} fullWidth showLabels width={400} height={80} labelFontSize={9} />
                  : <SparklinePlaceholder height={80} />}
              </div>
              <input
                value={noteVal}
                onChange={e => setNoteVal(e.target.value)}
                onBlur={commitNote}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
                  if (e.key === 'Escape') { setNoteVal(savedNote); (e.target as HTMLInputElement).blur() }
                }}
                onClick={e => e.stopPropagation()}
                className="text-sm base:text-base sm:text-sm px-2 py-1.5 rounded bg-stone-800 border border-stone-700 text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors w-full"
                placeholder="Add a note..."
              />
            </div>
          </div>
        </td>
      </tr>
    )}

    {showEdit && (
      <tr><td colSpan={6} style={{ padding: 0, border: 'none' }}>
        <EditModal row={row} onClose={() => setShowEdit(false)} onSaved={onSaved} />
      </td></tr>
    )}
    </>
  )
}

function CardTable({
  rows,
  onDelete,
  emptyLabel,
  sparklines,
  pendingDelete,
  autoExpandName,
  onSaved,
}: {
  rows: CardResult[]
  onDelete: (name: string, rowKey: string) => void
  emptyLabel: string
  sparklines?: Map<string, { values: number[], dates: string[] }>
  pendingDelete: string | null
  autoExpandName?: string | null
  onSaved?: () => void
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const autoExpandedRef = useRef(false)

  useEffect(() => {
    if (!autoExpandName || autoExpandedRef.current) return
    const idx = rows.findIndex(r => r.displayName === autoExpandName)
    if (idx === -1) return
    autoExpandedRef.current = true
    const rKey = `${rows[idx].displayName}-${idx}`
    setExpandedKey(rKey)
    setTimeout(() => {
      document.getElementById(`binder-row-${rKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }, [autoExpandName, rows])

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-stone-800">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Card</th>
            <th className="hidden md:table-cell lg:hidden xl:table-cell text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Basis</th>
            <th className="hidden md:table-cell lg:hidden xl:table-cell text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Now</th>
            <th className="text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">%</th>
            <th className="text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-stone-600 text-sm">{emptyLabel}</td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const rKey = `${row.displayName}-${i}`
              return (
                <CardRow
                  key={rKey}
                  rowId={`binder-row-${rKey}`}
                  row={row}
                  onDelete={onDelete}
                  sparkline={sparklines?.get(row.displayName)}
                  pendingDelete={pendingDelete}
                  expanded={expandedKey === rKey}
                  onToggleExpand={() => setExpandedKey(k => k === rKey ? null : rKey)}
                  onSaved={onSaved}
                />
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}


export default function BinderPage() {
  // Binder state
  const [entries, setEntries] = useState<BinderEntry[]>([])
  const [results, setResults] = useState<Map<string, CardResult>>(new Map())
  const [streaming, setStreaming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [addQuery, setAddQuery] = useState('')

  const [addCandidates, setAddCandidates] = useState<Candidate[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkMinPrice, setBulkMinPrice] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ name: string; status: 'added' | 'skipped' | 'error'; message?: string; price?: number }[]>([])
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exportSince, setExportSince] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [showImportCsv, setShowImportCsv] = useState(false)
  const [importCsvLoading, setImportCsvLoading] = useState(false)
  const [importCsvResults, setImportCsvResults] = useState<{ name: string; status: 'added' | 'skipped' | 'error'; message?: string; price?: number }[]>([])
  const [csvMinPrice, setCsvMinPrice] = useState('2')
  useEffect(() => {
    if (importLogRef.current) importLogRef.current.scrollTop = importLogRef.current.scrollHeight
  }, [importCsvResults])
  const [importCsvProgress, setImportCsvProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null)
  const [gainersOpen, setGainersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [losersOpen, setLosersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [flatOpen, setFlatOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [pendingAddName, setPendingAddName] = useState<string | null>(null)
  const [autoExpandName, setAutoExpandName] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const csvFileInputRef = useRef<HTMLInputElement>(null)
  const importLogRef = useRef<HTMLDivElement>(null)
  const expandParamRef = useRef<string | null>(null)

  // History state
  const [binderHistory, setBinderHistory] = useState<{ date: string; total: number; card_count?: number | null }[]>([])
  const [binderUpdatedAt, setBinderUpdatedAt] = useState<Date | null>(null)
  const [cardHistory, setCardHistory] = useState<Record<string, Array<{ date: string; price: number }>>>({})

  useEffect(() => {
    expandParamRef.current = new URLSearchParams(window.location.search).get('expand')

    fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'binder' }) })

    if (localStorage.getItem(LS_CACHE_VERSION) !== CACHE_VERSION) {
      localStorage.removeItem(LS_BINDER_ENTRIES)
      localStorage.removeItem(LS_BINDER_RESULTS)
      localStorage.removeItem(LS_BINDER_HISTORY)
      localStorage.setItem(LS_CACHE_VERSION, CACHE_VERSION)
    }

    const cachedEntries = localStorage.getItem(LS_BINDER_ENTRIES)
    const cachedResults = localStorage.getItem(LS_BINDER_RESULTS)
    const cachedHistory = localStorage.getItem(LS_BINDER_HISTORY)
    const cachedCardHistory = localStorage.getItem(LS_BINDER_CARD_HISTORY)
    if (cachedEntries) setEntries(JSON.parse(cachedEntries))
    if (cachedResults) setResults(new Map(JSON.parse(cachedResults)))
    if (cachedHistory) setBinderHistory(JSON.parse(cachedHistory))
    if (cachedCardHistory) setCardHistory(JSON.parse(cachedCardHistory))

    fetch('/api/binder')
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries)
        localStorage.setItem(LS_BINDER_ENTRIES, JSON.stringify(data.entries))
        if (expandParamRef.current) {
          const match = (data.entries as BinderEntry[]).find(e => e.displayName === expandParamRef.current)
          if (match) {
            setAutoExpandName(expandParamRef.current)
            setGainersOpen(true)
          }
        }
        const lastStreamAt = localStorage.getItem(LS_STREAM_AT)
        const isStale = !lastStreamAt || Date.now() - parseInt(lastStreamAt) > STREAM_TTL
        if (isStale) startStream()
      })
    fetch('/api/binder/history').then(r => r.json()).then(h => {
      if (Array.isArray(h)) {
        setBinderHistory(h)
        localStorage.setItem(LS_BINDER_HISTORY, JSON.stringify(h))
      }
    })
    fetch('/api/binder/card-history').then(r => r.json()).then(h => {
      if (h && typeof h === 'object' && !h.error) {
        setCardHistory(h)
        localStorage.setItem(LS_BINDER_CARD_HISTORY, JSON.stringify(h))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // --- Binder functions ---

  function handleAddInput(value: string) {
    setAddQuery(value)
    setAddCandidates([])
    setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) return
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/card?q=${encodeURIComponent(value)}&candidates=true`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setAddCandidates(data)
          setShowDropdown(true)
        }
      }
    }, 400)
  }


  async function deleteCard(name: string, rKey: string) {
    const entry = entries.find(e => makeRowKey(e.displayName, e.setCode, e.foilType) === rKey)
    await fetch('/api/binder/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry?.id, name }),
    })
    setEntries(prev => prev.filter(e => makeRowKey(e.displayName, e.setCode, e.foilType) !== rKey))
    setResults(prev => { const next = new Map(prev); next.delete(rKey); return next })
  }

  function requestDelete(name: string, rKey: string) {
    if (pendingDelete === rKey) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      setPendingDelete(null)
      deleteCard(name, rKey)
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
      setPendingDelete(rKey)
      deleteTimerRef.current = setTimeout(() => setPendingDelete(null), 3000)
    }
  }

  async function clearBinder() {
    setClearLoading(true)
    const res = await fetch('/api/binder/clear', { method: 'DELETE' })
    if (res.ok) {
      setEntries([])
      setResults(new Map())
      setBinderHistory([])
      localStorage.removeItem(LS_BINDER_ENTRIES)
      localStorage.removeItem(LS_BINDER_RESULTS)
      localStorage.removeItem(LS_BINDER_HISTORY)
    }
    setClearLoading(false)
    setClearConfirm(false)
  }

  function addCard(name = addQuery) {
    if (!name.trim()) return
    setAddCandidates([])
    setShowDropdown(false)
    setAddQuery('')
    setPendingAddName(name.trim())
  }

  function handleSavedFromModal() {
    fetch('/api/binder').then(r => r.json()).then(d => {
      setEntries(d.entries)
      localStorage.setItem(LS_BINDER_ENTRIES, JSON.stringify(d.entries))
      startStream()
    })
  }

  function handleAddedFromModal() {
    fetch('/api/binder').then(r => r.json()).then(d => {
      setEntries(d.entries)
      startStream()
    })
  }

  async function bulkImport() {
    const lines = bulkText.split('\n').filter(l => l.trim())
    if (!lines.length) return
    setBulkLoading(true)
    setBulkResults([])
    setBulkProgress(null)

    const res = await fetch('/api/binder/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, minPrice: bulkMinPrice ? parseFloat(bulkMinPrice) : undefined }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        const msg = JSON.parse(part.slice(6))
        if (msg.type === 'total') {
          setBulkProgress({ current: 0, total: msg.count })
        } else if (msg.type === 'result') {
          setBulkResults(prev => [...prev, msg])
          setBulkProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
        } else if (msg.type === 'done') {
          fetch('/api/binder').then(r => r.json()).then(d => {
            setEntries(d.entries)
            startStream()
          })
        }
      }
    }

    setBulkLoading(false)
  }

  function startStream() {
    if (streaming) return
    esRef.current?.close()
    setProgress(0)
    setStreaming(true)

    const es = new EventSource('/api/binder/stream')
    esRef.current = es

    es.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'total') {
        setTotal(msg.count)
      } else if (msg.type === 'card') {
        setResults(prev => {
          const next = new Map(prev)
          next.set(makeRowKey(msg.displayName, msg.setCode, msg.foilType ?? 'none'), msg)
          return next
        })
        setProgress(p => p + 1)
      } else if (msg.type === 'done') {
        setStreaming(false)
        setBinderUpdatedAt(new Date())
        localStorage.setItem(LS_STREAM_AT, Date.now().toString())
        es.close()
        setResults(prev => {
          localStorage.setItem(LS_BINDER_RESULTS, JSON.stringify(Array.from(prev.entries())))

          // Keep homepage highlights cache in sync with fresh binder prices
          const totalDelta = parseFloat(Array.from(prev.values()).reduce((sum, r) => {
            const costBasis = (r.purchasePrice != null ? r.purchasePrice : r.snapshotPrice) ?? 0
            return sum + ((r.currentPrice ?? r.snapshotPrice) - costBasis)
          }, 0).toFixed(2))
          try {
            const cached = localStorage.getItem(LS_HIGHLIGHTS)
            const highlights = cached ? JSON.parse(cached) : {}
            localStorage.setItem(LS_HIGHLIGHTS, JSON.stringify({ ...highlights, totalDelta }))
          } catch { /* ignore */ }

          const prices: Record<string, number> = {}
          for (const r of prev.values()) {
            if (r.currentPrice != null) prices[r.displayName] = r.currentPrice
          }
          if (Object.keys(prices).length > 0) {
            fetch('/api/binder/card-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prices }),
            }).then(r => r.json()).then(h => {
              if (h && typeof h === 'object' && !h.error) {
                setCardHistory(h)
                localStorage.setItem(LS_BINDER_CARD_HISTORY, JSON.stringify(h))
              }
            })
          }

          return prev
        })
      }
    }

    es.onerror = () => {
      setStreaming(false)
      es.close()
    }
  }

  async function importFromCsv() {
    if (!selectedCsvFile) return
    setImportCsvLoading(true)
    setImportCsvResults([])
    setImportCsvProgress(null)

    const csvText = await selectedCsvFile.text()
    const res = await fetch('/api/binder/import-csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvText, minPrice: csvMinPrice ? parseFloat(csvMinPrice) : undefined }) })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        const msg = JSON.parse(part.slice(6))
        if (msg.type === 'total') {
          setImportCsvProgress({ current: 0, total: msg.count })
        } else if (msg.type === 'result') {
          setImportCsvResults(prev => [...prev, msg])
          setImportCsvProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
        } else if (msg.type === 'done') {
          fetch('/api/binder').then(r => r.json()).then(d => {
            setEntries(d.entries)
            startStream()
          })
        }
      }
    }

    setImportCsvLoading(false)
  }

  async function downloadExport() {
    setExportStatus('Exporting...')
    const res = await fetch(`/api/binder/export?since=${exportSince}`)
    if (res.status === 404) { setExportStatus('No cards added since that date'); return }
    if (!res.ok) { setExportStatus('Error fetching export'); return }
    const text = await res.text()
    const count = text.trim().split('\n').length - 1 // subtract header row
    const blob = new Blob([text], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `moxfield_export_${exportSince}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportStatus(`Downloaded ${count} card${count !== 1 ? 's' : ''}`)
  }

  // --- Binder derived data ---
  const rows: CardResult[] = entries.map(e => {
    const rKey = makeRowKey(e.displayName, e.setCode, e.foilType)
    const result = results.get(rKey)
    const sortedHistory = (cardHistory[e.displayName] ?? []).slice().sort((a, b) => a.date < b.date ? -1 : 1)
    const latestEntry = sortedHistory.at(-1)
    const currentPrice = latestEntry?.price ?? result?.currentPrice ?? null
    const costBasis = e.purchasePrice != null ? e.purchasePrice : (e.addedPrice ?? e.snapshotPrice)
    const pct = currentPrice != null && costBasis > 0
      ? ((currentPrice - costBasis) / costBasis) * 100
      : result?.pct ?? null

    const latestDay = latestEntry?.date.split('T')[0] ?? null
    // Find the most recent history entry with a price that actually differs from current
    const lastChangedEntry = currentPrice != null
      ? [...sortedHistory].reverse().slice(1).find(h => Math.abs(h.price - currentPrice) >= 0.01)
      : undefined
    const dailyBaseline = lastChangedEntry?.price ?? null
    const rawDailyPct = currentPrice != null && lastChangedEntry != null && lastChangedEntry.price > 0
      ? ((currentPrice - lastChangedEntry.price) / lastChangedEntry.price) * 100
      : null
    const dailyPct = rawDailyPct !== null && Math.abs(rawDailyPct) < 0.01 ? null : rawDailyPct
    const dailyDaysAgo = lastChangedEntry && latestDay
      ? Math.round((new Date(latestDay).getTime() - new Date(lastChangedEntry.date.split('T')[0]).getTime()) / 86400000)
      : null
    return result
      ? { ...result, pct, dailyPct, dailyBaseline, dailyDaysAgo, rowKey: rKey, foilType: e.foilType, purchasePrice: e.purchasePrice, condition: e.condition, note: e.note ?? undefined }
      : { displayName: e.displayName, snapshotPrice: e.snapshotPrice, purchasePrice: e.purchasePrice, condition: e.condition, currentPrice: null, pct: null, dailyPct: null, dailyBaseline: null, dailyDaysAgo: null, imageUrl: null, fromCache: false, rowKey: rKey, foilType: e.foilType, note: e.note ?? undefined }
  })

  const filteredRows = searchQuery.trim()
    ? rows.filter(r => r.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    : rows

  const MIN_DAILY_PCT = 1
  const MAX_DAILY_DAYS = 2
  const gainers = filteredRows.filter(r => (r.dailyPct ?? 0) >= MIN_DAILY_PCT && (r.dailyDaysAgo ?? 1) <= MAX_DAILY_DAYS).sort((a, b) => (b.dailyPct ?? 0) - (a.dailyPct ?? 0))
  const losers = filteredRows.filter(r => (r.dailyPct ?? 0) <= -MIN_DAILY_PCT && (r.dailyDaysAgo ?? 1) <= MAX_DAILY_DAYS).sort((a, b) => (a.dailyPct ?? 0) - (b.dailyPct ?? 0))
  const flat = filteredRows.filter(r => r.dailyPct === null || Math.abs(r.dailyPct) < MIN_DAILY_PCT || (r.dailyDaysAgo ?? 1) > MAX_DAILY_DAYS)
  const pending = filteredRows.filter(r => r.pct === null)

  const totalCurrentValue = rows.reduce((sum, r) => sum + (r.currentPrice ?? r.snapshotPrice), 0)
  const totalSnapshotValue = rows.reduce((sum, r) => sum + r.snapshotPrice, 0)
  const totalDelta = results.size > 0 ? totalCurrentValue - totalSnapshotValue : null
  const totalPct = totalDelta != null && totalSnapshotValue > 0 ? (totalDelta / totalSnapshotValue) * 100 : null
  const binderSparkValues = binderHistory.map(h => h.total)

  const gainersDelta = gainers.filter(r => (r.dailyDaysAgo ?? 1) <= 1).reduce((sum, r) => sum + ((r.currentPrice ?? 0) - (r.dailyBaseline ?? r.snapshotPrice)), 0)
  const losersDelta = losers.filter(r => (r.dailyDaysAgo ?? 1) <= 1).reduce((sum, r) => sum + ((r.currentPrice ?? 0) - (r.dailyBaseline ?? r.snapshotPrice)), 0)

return (
    <div>
      {pendingAddName && (
        <EditModal
          row={{ displayName: pendingAddName, snapshotPrice: 0, currentPrice: null, pct: null, dailyPct: null, dailyBaseline: null, imageUrl: null, fromCache: false }}
          isNew
          onAdded={handleAddedFromModal}
          onClose={() => setPendingAddName(null)}
        />
      )}

      {/* Desktop header */}
      <div className="hidden lg:block mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-stone-100">Binder</h1>
          {streaming && <span className="text-sm text-stone-500">Loading… {progress}/{total}</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {results.size > 0 ? (
            <>
              <span className="text-lg font-mono font-semibold text-stone-100">${totalCurrentValue.toFixed(2)}</span>
              {totalDelta != null && totalPct != null && (
                <span className={`text-sm font-mono font-semibold ${totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(2)} ({totalDelta >= 0 ? '▲' : '▼'}{Math.abs(totalPct).toFixed(1)}%)
                </span>
              )}
              <span className="text-stone-700">·</span>
              <span className={`text-sm ${gainersDelta > 0 ? 'text-green-400' : 'text-stone-500'}`}>▲ {gainers.length}</span>
              <span className={`text-sm ${losersDelta < 0 ? 'text-red-400' : 'text-stone-500'}`}>▼ {losers.length}</span>
              <span className="text-stone-700">·</span>
              <span className="text-xs text-stone-500">{entries.length} cards</span>
              {binderUpdatedAt && (
                <>
                  <span className="text-stone-700">·</span>
                  <span className="text-xs text-stone-600">Updated {binderUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </>
          ) : (
            <span className="text-sm text-stone-600">{entries.length} cards</span>
          )}
        </div>
        {binderSparkValues.length >= 1 && (
          <div className="mt-3 bg-stone-800/40 border border-stone-700 rounded-xl px-4 py-3">
            <CollectionChart data={binderHistory} labelFontSize={7} countFontSize={7} />
          </div>
        )}
      </div>

      {/* Mobile quick-view card */}
      <div className="lg:hidden bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {results.size > 0 ? (
              <>
                <p className="text-2xl font-bold font-mono text-stone-100">${totalCurrentValue.toFixed(2)}</p>
                {totalDelta != null && totalPct != null && (
                  <p className={`text-sm font-mono font-semibold mt-0.5 ${totalDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(2)} ({totalDelta >= 0 ? '▲' : '▼'}{Math.abs(totalPct).toFixed(1)}%)
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-600">{entries.length} cards</p>
            )}
          </div>
          {streaming && <span className="text-xs text-stone-500 shrink-0 mt-1">Loading… {progress}/{total}</span>}
        </div>
        {binderSparkValues.length >= 1 && (
          <div className="bg-stone-800/40 border border-stone-700 rounded-xl px-4 py-3">
            <CollectionChart data={binderHistory} height={180} labelFontSize={7} countFontSize={14} labelsOnMobile />
          </div>
        )}
        {results.size > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-4">
            <span className={`text-sm font-semibold whitespace-nowrap ${gainersDelta > 0 ? 'text-green-400' : 'text-stone-600'}`}>
              ▲ {gainers.length}{gainersDelta > 0 ? ` · +$${gainersDelta.toFixed(2)}` : ''}
            </span>
            <span className="text-stone-700">·</span>
            <span className={`text-sm font-semibold whitespace-nowrap ${losersDelta < 0 ? 'text-red-400' : 'text-stone-600'}`}>
              ▼ {losers.length}{losersDelta < 0 ? ` · -$${Math.abs(losersDelta).toFixed(2)}` : ''}
            </span>
            <span className="text-stone-700">·</span>
            <span className="text-sm font-semibold text-stone-600">— {flat.length}</span>
          </div>
        )}
        {binderUpdatedAt && (
          <div className="mt-2 flex justify-end">
            <p className="text-xs text-stone-700">
              Updated {binderUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>

      {/* Add card input */}
      <div className="relative mb-4" ref={addDropdownRef}>
        <div className="flex gap-2">
          <input
            ref={addInputRef}
            value={addQuery}
            onChange={e => handleAddInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !showDropdown) addCard(); if (e.key === 'Escape') setShowDropdown(false) }}
            onFocus={() => addCandidates.length > 0 && setShowDropdown(true)}
            placeholder="Add a card to binder..."
            className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-4 py-2 text-base sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
          />
        </div>

        {showDropdown && addCandidates.length > 0 && (
          <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl">
            {addCandidates.map(c => (
              <button
                key={`${c.name}-${c.setCode}`}
                onMouseDown={(e) => { e.preventDefault(); addInputRef.current?.blur(); addCard(c.name) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800 transition-colors border-b border-stone-800 last:border-0 text-left"
              >
                <div>
                  <p className="text-stone-200 text-sm font-medium">{c.name}</p>
                  <p className="text-stone-500 text-xs">{c.type_line}</p>
                </div>
                {c.price && <span className="text-green-400 font-mono text-sm ml-4">${c.price.toFixed(2)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search + Manage toolbar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search binder..."
            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-2 text-base sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors px-1"
            >×</button>
          )}
        </div>
        <button
          onClick={() => { setShowManage(b => !b); if (showManage) { setShowBulk(false); setShowImportCsv(false); setShowExport(false) } }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showManage ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-amber-800/60 text-amber-500 hover:border-amber-700 hover:text-amber-400 bg-stone-800'}`}
        >
          Manage
        </button>
      </div>

      {/* Manage sub-buttons */}
      {showManage && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setShowBulk(b => !b); setBulkResults([]); setBulkProgress(null); setShowImportCsv(false); setShowExport(false) }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${showBulk ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-900'}`}
          >
            Bulk add
          </button>
          <button
            onClick={() => { setShowImportCsv(b => !b); setImportCsvResults([]); setImportCsvProgress(null); setShowBulk(false); setShowExport(false) }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${showImportCsv ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-900'}`}
          >
            Import CSV
          </button>
          <button
            onClick={() => { setShowExport(b => !b); setExportStatus(null); setShowBulk(false); setShowImportCsv(false) }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${showExport ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-900'}`}
          >
            Export CSV
          </button>
        </div>
      )}

      {/* Bulk add panel */}
      {showBulk && (
        <div className="mb-4 bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-stone-500 text-xs">One card per line. Supports: <span className="text-stone-400 font-mono">Card Name</span>, <span className="text-stone-400 font-mono">1x Card Name</span>, <span className="text-stone-400 font-mono">Card Name (SET)</span>, <span className="text-stone-400 font-mono">Card Name // note</span></p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder={"Format: Card Name (set) collector# // foil\nArcane Signet (cmm) 273\nSheoldred, the Apocalypse (dmu) 107 // foil\nSol Ring"}
            className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200 font-mono placeholder-stone-700 focus:outline-none focus:border-amber-600 resize-none overflow-y-scroll transition-colors"
          />
          {bulkProgress && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
              </div>
              <span className="text-stone-500 text-xs shrink-0">{bulkProgress.current}/{bulkProgress.total}</span>
            </div>
          )}
          {bulkResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {bulkResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={r.status === 'added' ? 'text-green-400' : r.status === 'skipped' ? 'text-stone-500' : 'text-red-400'}>
                    {r.status === 'added' ? '✓' : r.status === 'skipped' ? '–' : '✗'}
                  </span>
                  <span className="text-stone-300">{r.name}</span>
                  {r.price != null && <span className="text-stone-500 font-mono">${r.price.toFixed(2)}</span>}
                  {r.message && <span className="text-stone-600">{r.message}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2">
              <span className="text-stone-500 text-sm">Min $</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bulkMinPrice}
                onChange={e => setBulkMinPrice(e.target.value)}
                placeholder="0.00"
                className="w-16 bg-transparent text-sm text-stone-200 placeholder-stone-600 focus:outline-none"
              />
            </div>
            <button
              onClick={bulkImport}
              disabled={bulkLoading || !bulkText.trim()}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 rounded-lg text-sm font-medium text-amber-100 transition-colors"
            >
              {bulkLoading ? 'Importing...' : 'Import'}
            </button>
            {!bulkLoading && bulkResults.length > 0 && (
              <button
                onClick={() => { setBulkText(''); setBulkResults([]); setBulkProgress(null); setShowBulk(false) }}
                className="px-4 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Import CSV panel */}
      {showImportCsv && (
        <div className="mb-4 bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-stone-500 text-xs">Import a Moxfield haves CSV. Skips proxies, playtests, and cards already in the binder.</p>
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => setSelectedCsvFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => csvFileInputRef.current?.click()}
              disabled={importCsvLoading}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 border border-stone-600 rounded-lg text-sm text-stone-300 transition-colors"
            >
              Choose file
            </button>
            <span className="text-xs text-stone-500 truncate">{selectedCsvFile ? selectedCsvFile.name : 'No file chosen'}</span>
          </div>
          {importCsvProgress && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: `${(importCsvProgress.current / importCsvProgress.total) * 100}%` }} />
              </div>
              <span className="text-stone-500 text-xs shrink-0">{importCsvProgress.current}/{importCsvProgress.total}</span>
            </div>
          )}
          {importCsvResults.length > 0 && (
            <div ref={importLogRef} className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {importCsvResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={r.status === 'added' ? 'text-green-400' : r.status === 'skipped' ? 'text-stone-500' : 'text-red-400'}>
                    {r.status === 'added' ? '✓' : r.status === 'skipped' ? '–' : '✗'}
                  </span>
                  <span className="text-stone-300">{r.name}</span>
                  {r.price != null && <span className="text-stone-500 font-mono">${r.price.toFixed(2)}</span>}
                  {r.message && <span className="text-stone-600">{r.message}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2">
              <span className="text-stone-500 text-sm">Min $</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={csvMinPrice}
                onChange={e => setCsvMinPrice(e.target.value)}
                placeholder="0.00"
                className="w-16 bg-transparent text-sm text-stone-200 placeholder-stone-600 focus:outline-none"
              />
            </div>
            <button
              onClick={importFromCsv}
              disabled={importCsvLoading || !selectedCsvFile}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 rounded-lg text-sm font-medium text-amber-100 transition-colors"
            >
              {importCsvLoading ? 'Importing...' : 'Import'}
            </button>
            {!importCsvLoading && importCsvResults.length > 0 && (
              <button
                onClick={() => { setImportCsvResults([]); setImportCsvProgress(null); setShowImportCsv(false); setSelectedCsvFile(null) }}
                className="px-4 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Export panel */}
      {showExport && (
        <div className="mb-4 bg-stone-900 border border-stone-700 rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <span className="text-stone-500 text-sm">Cards added since</span>
          <input
            type="date"
            value={exportSince}
            onChange={e => { setExportSince(e.target.value); setExportStatus(null) }}
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-base sm:text-sm text-stone-100 focus:outline-none focus:border-amber-600 transition-colors"
          />
          <button
            onClick={downloadExport}
            className="px-4 py-1.5 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 text-amber-200 rounded-lg text-sm font-medium transition-colors"
          >
            Download CSV
          </button>
          {exportStatus && <span className="text-sm text-stone-400">{exportStatus}</span>}
        </div>
      )}

          {/* Progress bar */}
          {streaming && (
            <div className="mb-6 bg-stone-800 rounded-full overflow-hidden h-1.5">
              <div
                className="h-full bg-amber-600 transition-all duration-300"
                style={{ width: total ? `${(progress / total) * 100}%` : '0%' }}
              />
            </div>
          )}



          {/* Empty state */}
          {entries.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-stone-400 font-semibold">Your binder is empty</p>
              <p className="text-sm text-stone-600">Search for a card above to add it and start tracking prices.</p>
            </div>
          )}

          {/* Two-column layout */}
          {entries.length > 0 && <><div id="binder-gainers-losers" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="binder-gainers">
              <button
                onClick={() => setGainersOpen(o => !o)}
                className="w-full flex items-center gap-2 mb-3 text-left"
              >
                <span className="text-green-400 font-semibold">▲ Gainers</span>
                {gainers.length > 0 && <span className="text-stone-600 font-normal text-sm">{gainers.length} cards</span>}
                {!gainersOpen && (gainers[0]?.dailyPct != null || gainersDelta > 0) && (
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    {gainers[0]?.dailyPct != null && <span className="text-green-400 font-mono text-sm">▲{gainers[0].dailyPct.toFixed(1)}%</span>}
                    {gainersDelta > 0 && <span className="text-green-400 font-mono text-sm">+${gainersDelta.toFixed(2)}</span>}
                  </span>
                )}
                <span className="text-stone-400 text-sm shrink-0 ml-auto">{gainersOpen ? '▲' : '▼'}</span>
              </button>
              {gainersOpen && (
                <CardTable
                  rows={gainers}
                  onDelete={requestDelete}
                  emptyLabel={results.size === 0 ? 'Loading...' : 'No gainers'}
                  pendingDelete={pendingDelete}
                  sparklines={new Map(Object.entries(cardHistory).map(([k, v]) => [k, { values: v.map(p => p.price), dates: v.map(p => p.date) }]))}
                  autoExpandName={autoExpandName}
                  onSaved={handleSavedFromModal}
                />
              )}
            </div>
            <div id="binder-losers">
              <button
                onClick={() => setLosersOpen(o => !o)}
                className="w-full flex items-center gap-2 mb-3 text-left"
              >
                <span className="text-red-400 font-semibold">▼ Losers</span>
                {losers.length > 0 && <span className="text-stone-600 font-normal text-sm">{losers.length} cards</span>}
                {!losersOpen && (losers[0]?.dailyPct != null || losersDelta < 0) && (
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    {losers[0]?.dailyPct != null && <span className="text-red-400 font-mono text-sm">▼{Math.abs(losers[0].dailyPct).toFixed(1)}%</span>}
                    {losersDelta < 0 && <span className="text-red-400 font-mono text-sm">-${Math.abs(losersDelta).toFixed(2)}</span>}
                  </span>
                )}
                <span className="text-stone-400 text-sm shrink-0 ml-auto">{losersOpen ? '▲' : '▼'}</span>
              </button>
              {losersOpen && (
                <CardTable
                  rows={losers}
                  onDelete={requestDelete}
                  emptyLabel={results.size === 0 ? 'Loading...' : 'No losers'}
                  pendingDelete={pendingDelete}
                  sparklines={new Map(Object.entries(cardHistory).map(([k, v]) => [k, { values: v.map(p => p.price), dates: v.map(p => p.date) }]))}
                  onSaved={handleSavedFromModal}
                />
              )}
            </div>
          </div>

          {/* Flat cards */}
          {flat.length > 0 && (
            <div id="binder-unchanged" className="mt-8">
              <button
                onClick={() => setFlatOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl border border-stone-800 bg-stone-900 hover:border-stone-700 hover:bg-stone-800/60 transition-colors mb-3"
              >
                <span className="text-stone-400 font-semibold text-sm">Unchanged</span>
                <span className="text-stone-600 font-normal text-sm">{flat.length} cards</span>
                <span className="text-stone-600 text-xs ml-auto">{flatOpen ? '▲' : '▼'}</span>
              </button>
              {flatOpen && (
                <CompactCardGrid
                  rows={flat}
                  onDelete={requestDelete}
                  pendingDelete={pendingDelete}
                  sparklines={new Map(Object.entries(cardHistory).map(([k, v]) => [k, { values: v.map(p => p.price), dates: v.map(p => p.date) }]))}
                  onSaved={handleSavedFromModal}
                />
              )}
            </div>
          )}</>}

        {/* Clear binder */}
        <div className="mt-16 pt-8 border-t border-stone-800 flex justify-end">
          {clearConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-400">Remove all cards from your binder?</span>
              <button
                onClick={() => setClearConfirm(false)}
                className="text-sm px-3 py-1.5 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearBinder}
                disabled={clearLoading}
                className="text-sm px-3 py-1.5 rounded border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                {clearLoading ? 'Clearing…' : 'Yes, clear it'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setClearConfirm(true)}
              className="text-sm text-stone-600 hover:text-red-400 transition-colors"
            >
              Clear binder
            </button>
          )}
        </div>

    </div>
  )
}
