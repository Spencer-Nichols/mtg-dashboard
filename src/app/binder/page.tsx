'use client'

import { useState, useEffect, useRef } from 'react'

interface BinderEntry {
  id: string
  displayName: string
  baseName: string
  setCode: string
  scryfallId: string | null
  foil: boolean
  count: number
  snapshotPrice: number
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
  imageUrl: string | null
  backImageUrl?: string | null
  fromCache?: boolean
  note?: string
  setName?: string
  setCode?: string
  rarity?: string
  typeLine?: string
  foil?: boolean
  rowKey?: string
}

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'Damaged'] as const
type Condition = typeof CONDITIONS[number]
type Candidate = { scryfallId?: string; name: string; setCode: string; setName: string; price: number | null; foilPrice?: number | null; type_line: string; collectorNumber?: string; rarity?: string; releasedAt?: string; imageUrl?: string | null }

function makeRowKey(displayName: string, setCode: string | null | undefined, foil: boolean): string {
  return `${displayName}||${setCode ?? ''}||${foil ? '1' : '0'}`
}

const SELL_THRESHOLD = -10 // % drop to flag as sell suggestion

const LS_BINDER_ENTRIES = 'tnk:binder:entries'
const LS_BINDER_RESULTS = 'tnk:binder:results'
const LS_BINDER_HISTORY = 'tnk:binder:history'
const LS_CACHE_VERSION = 'tnk:cache:version'
const CACHE_VERSION = '2'

function pctColor(pct: number | null, purchasePrice?: number | null) {
  if (purchasePrice === 0) return 'text-green-400'
  if (pct === null) return 'text-stone-500'
  if (pct > 0.05) return 'text-green-400'
  if (pct < -0.05) return 'text-red-400'
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

function Sparkline({ values, width = 72, height = 22, fullWidth = false, dates, showLabels = false, counts }: {
  values: number[]
  width?: number
  height?: number
  fullWidth?: boolean
  dates?: string[]
  showLabels?: boolean
  counts?: (number | null)[]
}) {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padLeft = showLabels ? 48 : 1.5
  const padRight = showLabels ? 48 : 1.5
  const padY = showLabels ? 16 : 1.5
  const padBottom = showLabels ? 16 : 1.5
  const x = (i: number) => padLeft + (values.length > 1 ? (i / (values.length - 1)) : 0) * (width - padLeft - padRight)
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

  // Event markers: vertical lines where card count changed
  const countMarkers: { i: number; delta: number }[] = []
  if (counts) {
    for (let k = 1; k < counts.length; k++) {
      if (counts[k] != null && counts[k - 1] != null && counts[k] !== counts[k - 1]) {
        countMarkers.push({ i: k, delta: (counts[k] as number) - (counts[k - 1] as number) })
      }
    }
  }

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
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={padLeft} y1={y(v)} x2={width - padRight} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
          <text x={padLeft - 4} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#475569">${Math.round(v)}</text>
        </g>
      ))}
      {xIndices.map(i => (
        <text key={i} x={x(i)} y={height - 2} textAnchor="middle" fontSize="9" fill="#475569">
          {dates![i].slice(5)}
        </text>
      ))}
      {countMarkers.map(({ i, delta }) => {
        const cx = x(i)
        const isAdd = delta > 0
        const markerColor = isAdd ? '#4ade80' : '#f87171'
        const label = isAdd ? `+${delta}` : `${delta}`
        return (
          <g key={i}>
            <line x1={cx} y1={padY} x2={cx} y2={height - padBottom} stroke={markerColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <text x={cx} y={padY - 3} textAnchor="middle" fontSize="8" fontWeight="600" fill={markerColor}>{label}</text>
          </g>
        )
      })}
      {showLabels && <path d={area} fill={`url(#${gradId})`} />}
      {values.length > 1
        ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        : <circle cx={x(0)} cy={y(values[0])} r="3" fill={color} />}
    </svg>
  )
}

function CardRow({
  row,
  onDelete,
  sparkline,
  pendingDelete,
  expanded,
  onToggleExpand,
}: {
  row: CardResult
  onDelete: (name: string, rowKey: string) => void
  pendingDelete: string | null
  sparkline?: number[]
  expanded: boolean
  onToggleExpand: () => void
}) {
  const diff = row.currentPrice != null ? row.currentPrice - row.snapshotPrice : null
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState(row.note ?? '')
  const [currentNote, setCurrentNote] = useState(row.note ?? '')
  const [showEdit, setShowEdit] = useState(false)
  const [editPrints, setEditPrints] = useState<Candidate[]>([])
  const [editPrintsLoading, setEditPrintsLoading] = useState(false)
  const [editFoil, setEditFoil] = useState(row.foil ?? false)
  const [editCondition, setEditCondition] = useState<string>(row.condition ?? 'NM')
  const [editPurchasePrice, setEditPurchasePrice] = useState(
    row.purchasePrice != null ? String(row.purchasePrice) : ''
  )
  const [editSaving, setEditSaving] = useState(false)
  const cancelNoteRef = useRef(false)

  async function openEdit() {
    setShowEdit(true)
    setEditPrintsLoading(true)
    const res = await fetch(`/api/card?q=${encodeURIComponent(row.displayName.replace(/\s*\/\/.*$/, '').trim())}&prints=true`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) setEditPrints(data)
    }
    setEditPrintsLoading(false)
  }

  async function saveEdit(scryfallId?: string, setCode?: string) {
    setEditSaving(true)
    const purchasePrice = editPurchasePrice.trim() === '' ? null : parseFloat(editPurchasePrice)
    const res = await fetch('/api/binder/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: row.displayName,
        scryfallId,
        setCode,
        foil: editFoil,
        purchasePrice,
        condition: editCondition,
      }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Failed to save: ${data.error ?? res.statusText}`)
      return
    }
    setShowEdit(false)
    window.location.reload()
  }

  function commitNote() {
    setEditingNote(false)
    if (cancelNoteRef.current) { cancelNoteRef.current = false; setNoteVal(currentNote); return }
    const trimmed = noteVal.trim()
    if (trimmed === currentNote) return
    setCurrentNote(trimmed)
    fetch('/api/binder/note', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: row.displayName, note: trimmed }),
    })
  }

  return (
    <>
    <tr
      className="group border-b border-stone-800 hover:bg-stone-800/50 transition-colors cursor-pointer"
      onClick={onToggleExpand}
    >
      <td className="px-4 py-3.5 text-stone-200 font-medium">
        <span className="flex items-center gap-2 flex-wrap">
          <span>{row.displayName}</span>
          {row.condition && row.condition !== 'NM' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-500 font-mono border border-stone-700">{row.condition}</span>
          )}
          {row.foil && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-500 font-mono border border-amber-900/40">foil</span>
          )}
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
              onClick={e => e.stopPropagation()}
              className="text-xs px-2 py-0.5 rounded bg-stone-800 border-2 border-amber-700 text-stone-200 placeholder-stone-600 focus:outline-none w-40"
              placeholder="Add a note..."
            />
          ) : (
            <span
              onClick={e => { e.stopPropagation(); setNoteVal(currentNote); setEditingNote(true) }}
              className={`text-xs cursor-text px-1 rounded hover:bg-stone-700 transition-colors ${currentNote ? 'text-stone-600' : 'opacity-0 group-hover:opacity-100 text-stone-700'}`}
            >
              {currentNote || '+ note'}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(row.displayName, row.rowKey ?? row.displayName) }}
            className={`hidden md:inline opacity-0 group-hover:opacity-100 text-xs px-2 py-0.5 rounded border transition-all ${
              pendingDelete === (row.rowKey ?? row.displayName)
                ? 'border-red-600 text-red-400 bg-red-900/30 opacity-100'
                : 'border-stone-700 text-stone-500 hover:border-red-700 hover:text-red-400'
            }`}
          >
            {pendingDelete === (row.rowKey ?? row.displayName) ? 'Sure?' : 'Remove'}
          </button>
        </span>
      </td>
      {sparkline && (
        <td className="hidden md:table-cell px-2 py-3.5">
          <Sparkline values={sparkline} />
        </td>
      )}
      <td className="hidden md:table-cell px-4 py-3.5 text-right text-stone-500 font-mono">
        ${row.snapshotPrice.toFixed(2)}
      </td>
      <td className="px-4 py-3.5 text-right font-mono text-stone-200">
        {row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : '—'}
        <p className="md:hidden text-xs text-stone-600">was ${row.snapshotPrice.toFixed(2)}</p>
      </td>
      <td className={`px-4 py-3.5 text-right font-mono font-semibold ${pctColor(row.pct, row.purchasePrice)}`}>
        {pctLabel(row.pct, row.currentPrice, row.purchasePrice)}
      </td>
      <td className={`hidden md:table-cell px-4 py-3.5 text-right font-mono ${diff != null && diff < 0 ? 'text-red-400' : diff != null && diff > 0 ? 'text-green-400' : 'text-stone-500'}`}>
        {diff != null ? `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` : '—'}
      </td>
    </tr>
    {expanded && (
      <tr className="border-b border-stone-800 bg-stone-900/50">
        <td colSpan={6} className="px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            {row.imageUrl && (
              <div className="flex gap-3 justify-center flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.imageUrl} alt={row.displayName} className="w-40 rounded-xl shadow-2xl" />
                {row.backImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.backImageUrl} alt={`${row.displayName} back`} className="w-40 rounded-xl shadow-2xl" />
                )}
              </div>
            )}
            <div className="flex gap-2 flex-wrap justify-center">
              <a
                href={`https://manapool.com/card/${row.displayName.replace(/\s*\/\/.*$/, '').replace(/\s*\(?(full art|showcase|extended art|borderless|etched|gilded|retro frame|promo pack|buy-a-box|surge foil|textured foil|foil etched|galaxy foil)\)?\s*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-xs px-3 py-1 rounded border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200 transition-colors"
              >
                View on Manapool ↗
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); openEdit() }}
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

          </div>
        </td>
      </tr>
    )}

    {/* Edit modal */}
    {showEdit && (
      <tr>
        <td colSpan={6} style={{ padding: 0, border: 'none' }}>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEdit(false)}
          >
            <div
              className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
                <div>
                  <p className="font-semibold text-stone-100">{row.displayName}</p>
                  <p className="text-xs text-stone-500">{row.setCode?.toUpperCase()} · {row.foil ? 'Foil' : 'Non-foil'}</p>
                </div>
                <button onClick={() => setShowEdit(false)} className="text-stone-500 hover:text-stone-200 text-xl leading-none">×</button>
              </div>

              <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

                {/* Condition + Foil + Purchase price */}
                <div className="flex flex-wrap gap-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-stone-500 uppercase tracking-wider">Condition</span>
                    <div className="flex gap-1">
                      {CONDITIONS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditCondition(c)}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                            editCondition === c
                              ? 'border-amber-600 text-amber-400 bg-amber-950/40'
                              : 'border-stone-700 text-stone-500 hover:border-stone-500'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-stone-500 uppercase tracking-wider">Foil</span>
                    <button
                      onClick={() => setEditFoil(f => !f)}
                      className={`text-xs px-3 py-1 rounded border transition-colors ${
                        editFoil
                          ? 'border-amber-600 text-amber-400 bg-amber-950/40'
                          : 'border-stone-700 text-stone-500 hover:border-stone-500'
                      }`}
                    >
                      {editFoil ? '★ Foil' : 'Non-foil'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                    <span className="text-xs text-stone-500 uppercase tracking-wider">Purchase price</span>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Scryfall price"
                        value={editPurchasePrice}
                        onChange={e => setEditPurchasePrice(e.target.value)}
                        className="flex-1 bg-stone-950 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 font-mono placeholder-stone-600 focus:outline-none focus:border-amber-600"
                      />
                      <button
                        onClick={() => setEditPurchasePrice('0')}
                        className="text-xs px-2 py-1 rounded border border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-300 transition-colors whitespace-nowrap"
                      >
                        Booster pull
                      </button>
                    </div>
                    {editPurchasePrice === '0' && (
                      <p className="text-xs text-stone-600">Shows dollar gain instead of %</p>
                    )}
                  </div>
                </div>

                {/* Printing grid */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-stone-500 uppercase tracking-wider">Select a printing</span>
                  {editPrintsLoading ? (
                    <p className="text-sm text-stone-600">Loading printings…</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {editPrints.map(p => (
                        <button
                          key={p.scryfallId ?? p.setCode}
                          onClick={() => saveEdit(p.scryfallId, p.setCode)}
                          disabled={editSaving}
                          className="flex flex-col rounded-xl border border-stone-700 hover:border-amber-600 transition-colors overflow-hidden text-left group disabled:opacity-50"
                        >
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.name} className="w-full" />
                          ) : (
                            <div className="w-full aspect-[63/88] bg-stone-800 flex items-center justify-center">
                              <span className="text-stone-600 text-xs">No image</span>
                            </div>
                          )}
                          <div className="px-2 py-1.5 bg-stone-850">
                            <p className="text-xs text-stone-300 font-medium truncate">{p.setName}</p>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs text-stone-600 font-mono">{p.setCode.toUpperCase()}</span>
                              <span className="text-xs font-mono text-stone-400">
                                {editFoil && p.foilPrice != null ? `$${p.foilPrice.toFixed(2)}` : p.price != null ? `$${p.price.toFixed(2)}` : '—'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 justify-end px-5 py-4 border-t border-stone-800">
                <button
                  onClick={() => setShowEdit(false)}
                  className="text-sm px-4 py-1.5 rounded border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveEdit()}
                  disabled={editSaving}
                  className="text-sm px-4 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
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
}: {
  rows: CardResult[]
  onDelete: (name: string, rowKey: string) => void
  emptyLabel: string
  sparklines?: Map<string, number[]>
  pendingDelete: string | null
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const hasSparklines = sparklines && sparklines.size > 0
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-stone-800">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Card</th>
            {hasSparklines && <th className="hidden md:table-cell px-2 py-3" />}
            <th className="hidden md:table-cell text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Was</th>
            <th className="text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Now</th>
            <th className="text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">%</th>
            <th className="hidden md:table-cell text-right px-4 py-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={hasSparklines ? 6 : 5} className="px-4 py-8 text-center text-stone-600 text-sm">{emptyLabel}</td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const rKey = `${row.displayName}-${i}`
              return (
                <CardRow
                  key={rKey}
                  row={row}
                  onDelete={onDelete}
                  sparkline={sparklines?.get(row.displayName)}
                  pendingDelete={pendingDelete}
                  expanded={expandedKey === rKey}
                  onToggleExpand={() => setExpandedKey(k => k === rKey ? null : rKey)}
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
  const [addNote, setAddNote] = useState('')
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addCandidates, setAddCandidates] = useState<Candidate[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [addPrintings, setAddPrintings] = useState<Candidate[]>([])
  const [addPrintingName, setAddPrintingName] = useState<string | null>(null)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ name: string; status: 'added' | 'skipped' | 'error'; message?: string; price?: number }[]>([])
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [exportSince, setExportSince] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [showSellSuggestions, setShowSellSuggestions] = useState(false)
  const [showImportCsv, setShowImportCsv] = useState(false)
  const [importCsvLoading, setImportCsvLoading] = useState(false)
  const [importCsvResults, setImportCsvResults] = useState<{ name: string; status: 'added' | 'skipped' | 'error'; message?: string; price?: number }[]>([])
  const [importCsvProgress, setImportCsvProgress] = useState<{ current: number; total: number } | null>(null)
  const [gainersOpen, setGainersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [losersOpen, setLosersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [flatOpen, setFlatOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // History state
  const [binderHistory, setBinderHistory] = useState<{ date: string; total: number; card_count?: number | null }[]>([])
  const [binderUpdatedAt, setBinderUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (localStorage.getItem(LS_CACHE_VERSION) !== CACHE_VERSION) {
      localStorage.removeItem(LS_BINDER_ENTRIES)
      localStorage.removeItem(LS_BINDER_RESULTS)
      localStorage.removeItem(LS_BINDER_HISTORY)
      localStorage.setItem(LS_CACHE_VERSION, CACHE_VERSION)
    }

    const cachedEntries = localStorage.getItem(LS_BINDER_ENTRIES)
    const cachedResults = localStorage.getItem(LS_BINDER_RESULTS)
    const cachedHistory = localStorage.getItem(LS_BINDER_HISTORY)
    if (cachedEntries) setEntries(JSON.parse(cachedEntries))
    if (cachedResults) setResults(new Map(JSON.parse(cachedResults)))
    if (cachedHistory) setBinderHistory(JSON.parse(cachedHistory))

    fetch('/api/binder')
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries)
        localStorage.setItem(LS_BINDER_ENTRIES, JSON.stringify(data.entries))
        startStream()
      })
    fetch('/api/binder/history').then(r => r.json()).then(h => {
      if (Array.isArray(h)) {
        setBinderHistory(h)
        localStorage.setItem(LS_BINDER_HISTORY, JSON.stringify(h))
      }
    })

    const INTERVAL = 60 * 60 * 1000
    const interval = setInterval(() => startStream(true), INTERVAL)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  // --- Binder functions ---

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
        if (Array.isArray(data) && data.length > 0) {
          setAddCandidates(data)
          setShowDropdown(true)
        }
      }
    }, 400)
  }

  async function selectNameForPrinting(name: string) {
    setAddCandidates([])
    setAddPrintingName(name)
    setAddPrintings([])
    const res = await fetch(`/api/card?q=${encodeURIComponent(name)}&prints=true`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setAddPrintings(data)
        setShowDropdown(true)
      }
    }
  }

  async function deleteCard(name: string, rKey: string) {
    const entry = entries.find(e => makeRowKey(e.displayName, e.setCode, e.foil) === rKey)
    await fetch('/api/binder/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry?.id, name }),
    })
    setEntries(prev => prev.filter(e => makeRowKey(e.displayName, e.setCode, e.foil) !== rKey))
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

  async function addCard(name = addQuery, setCode?: string, scryfallId?: string) {
    if (!name.trim()) return
    setAddLoading(true)
    setAddStatus(null)
    setAddCandidates([])
    setAddPrintings([])
    setAddPrintingName(null)
    setShowDropdown(false)
    const res = await fetch('/api/binder/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), setCode, scryfallId, note: addNote.trim() || undefined }),
    })
    const data = await res.json()
    if (data.candidates) {
      setAddCandidates(data.candidates)
      setShowDropdown(true)
    } else if (!res.ok) {
      setAddStatus({ type: 'error', message: data.error })
    } else {
      setAddStatus({ type: 'success', message: `Added ${data.name} (${data.setCode}) — $${data.price.toFixed(2)}` })
      setAddQuery('')
      setAddNote('')
      setResults(prev => {
        const next = new Map(prev)
        next.set(makeRowKey(data.name, data.setCode, false), { displayName: data.name, snapshotPrice: data.price, currentPrice: data.price, pct: 0, imageUrl: data.imageUrl ?? null, fromCache: false })
        return next
      })
      fetch('/api/binder').then(r => r.json()).then(d => setEntries(d.entries))
    }
    setAddLoading(false)
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
      body: JSON.stringify({ lines }),
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
          fetch('/api/binder').then(r => r.json()).then(d => { setEntries(d.entries); startStream() })
        }
      }
    }

    setBulkLoading(false)
  }

  function startStream(bust = false) {
    if (streaming) return
    esRef.current?.close()
    if (bust) setResults(new Map())
    setProgress(0)
    setStreaming(true)

    const es = new EventSource(`/api/binder/stream${bust ? '?bust=true' : ''}`)
    esRef.current = es

    es.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'total') {
        setTotal(msg.count)
      } else if (msg.type === 'card') {
        setResults(prev => {
          const next = new Map(prev)
          next.set(makeRowKey(msg.displayName, msg.setCode, msg.foil), msg)
          return next
        })
        setProgress(p => p + 1)
      } else if (msg.type === 'done') {
        setStreaming(false)
        setBinderUpdatedAt(new Date())
        es.close()
        setResults(prev => {
          localStorage.setItem(LS_BINDER_RESULTS, JSON.stringify(Array.from(prev.entries())))
          const total = Array.from(prev.values()).reduce((sum, r) => sum + (r.currentPrice ?? r.snapshotPrice), 0)
          fetch('/api/binder/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total, card_count: prev.size }),
          }).then(r => r.json()).then(h => {
            if (Array.isArray(h)) {
              setBinderHistory(h)
              localStorage.setItem(LS_BINDER_HISTORY, JSON.stringify(h))
            }
          })
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
    setImportCsvLoading(true)
    setImportCsvResults([])
    setImportCsvProgress(null)

    const res = await fetch('/api/binder/import-csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minPrice: 2.0 }) })
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
          fetch('/api/binder').then(r => r.json()).then(d => { setEntries(d.entries); startStream() })
        }
      }
    }

    setImportCsvLoading(false)
  }

  async function copyExport() {
    const res = await fetch(`/api/binder/export?since=${exportSince}`)
    const data = await res.json()
    if (!res.ok || !data.lines) { setExportStatus('Error fetching export'); return }
    if (data.lines.length === 0) { setExportStatus('No cards added since that date'); return }
    await navigator.clipboard.writeText(data.lines.join('\n'))
    setExportStatus(`Copied ${data.count} card${data.count !== 1 ? 's' : ''} to clipboard`)
  }

  // --- Binder derived data ---
  const rows: CardResult[] = entries.map(e => {
    const rKey = makeRowKey(e.displayName, e.setCode, e.foil)
    const result = results.get(rKey)
    return result
      ? { ...result, rowKey: rKey, foil: e.foil, purchasePrice: e.purchasePrice, condition: e.condition, note: e.note ?? undefined }
      : { displayName: e.displayName, snapshotPrice: e.snapshotPrice, purchasePrice: e.purchasePrice, condition: e.condition, currentPrice: null, pct: null, imageUrl: null, fromCache: false, rowKey: rKey, foil: e.foil, note: e.note ?? undefined }
  })

  const filteredRows = searchQuery.trim()
    ? rows.filter(r => r.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    : rows

  const gainers = filteredRows.filter(r => (r.pct ?? 0) > 0.05).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
  const losers = filteredRows.filter(r => (r.pct ?? 0) < -0.05).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
  const flat = filteredRows.filter(r => r.pct !== null && Math.abs(r.pct) <= 0.05)
  const pending = filteredRows.filter(r => r.pct === null)
  const sellSuggestions = filteredRows.filter(r => r.pct !== null && r.pct <= SELL_THRESHOLD)

  const totalCurrentValue = rows.reduce((sum, r) => sum + (r.currentPrice ?? r.snapshotPrice), 0)
  const totalSnapshotValue = rows.reduce((sum, r) => sum + r.snapshotPrice, 0)
  const totalDelta = results.size > 0 ? totalCurrentValue - totalSnapshotValue : null
  const totalPct = totalDelta != null && totalSnapshotValue > 0 ? (totalDelta / totalSnapshotValue) * 100 : null
  const binderSparkValues = binderHistory.map(h => h.total)

  const gainersDelta = gainers.reduce((sum, r) => sum + ((r.currentPrice ?? r.snapshotPrice) - r.snapshotPrice), 0)
  const losersDelta = losers.reduce((sum, r) => sum + ((r.currentPrice ?? r.snapshotPrice) - r.snapshotPrice), 0)

return (
    <div>
      {/* Desktop header */}
      <div className="hidden lg:block mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-stone-100">Binder</h1>
          {streaming
            ? <span className="text-sm text-stone-500">Refreshing… {progress}/{total}</span>
            : <button
                onClick={() => startStream(true)}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >
                ↻ refresh
              </button>
          }
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
              {sellSuggestions.length > 0 && (
                <>
                  <span className="text-stone-700">·</span>
                  <button
                    onClick={() => setShowSellSuggestions(s => !s)}
                    className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    ⚠ {sellSuggestions.length} down {Math.abs(SELL_THRESHOLD)}%+
                  </button>
                </>
              )}
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
            <Sparkline values={binderSparkValues} dates={binderHistory.map(h => h.date)} counts={binderHistory.map(h => h.card_count ?? null)} width={600} height={120} fullWidth showLabels />
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
          {streaming
            ? <span className="text-xs text-stone-500 shrink-0 mt-1">Refreshing… {progress}/{total}</span>
            : <button
                onClick={() => startStream(true)}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors shrink-0"
              >
                ↻ refresh
              </button>
          }
        </div>
        {binderSparkValues.length >= 1 && (
          <div className="bg-stone-800/40 border border-stone-700 rounded-xl px-4 py-3">
            <Sparkline values={binderSparkValues} dates={binderHistory.map(h => h.date)} counts={binderHistory.map(h => h.card_count ?? null)} width={600} height={80} fullWidth showLabels />
          </div>
        )}
        {results.size > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-4">
            <span className={`text-sm font-semibold ${gainersDelta > 0 ? 'text-green-400' : 'text-stone-600'}`}>
              ▲ {gainers.length}{gainersDelta > 0 ? ` · +$${gainersDelta.toFixed(2)}` : ''}
            </span>
            <span className="text-stone-700">·</span>
            <span className={`text-sm font-semibold ${losersDelta < 0 ? 'text-red-400' : 'text-stone-600'}`}>
              ▼ {losers.length}{losersDelta < 0 ? ` · -$${Math.abs(losersDelta).toFixed(2)}` : ''}
            </span>
            <span className="text-stone-700">·</span>
            <span className="text-sm font-semibold text-stone-600">— {flat.length}</span>
          </div>
        )}
        {(sellSuggestions.length > 0 || binderUpdatedAt) && (
          <div className="mt-2 flex items-center justify-between">
            {sellSuggestions.length > 0 ? (
              <button
                onClick={() => setShowSellSuggestions(s => !s)}
                className="text-xs text-amber-600 hover:text-amber-400 transition-colors"
              >
                {sellSuggestions.length} down {Math.abs(SELL_THRESHOLD)}%+ {showSellSuggestions ? '▲' : '▼'}
              </button>
            ) : <span />}
            {binderUpdatedAt && (
              <p className="text-xs text-stone-700">
                Updated {binderUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search + Export toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search binder..."
            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors px-1"
            >×</button>
          )}
        </div>
        <button
          onClick={() => { setShowExport(b => !b); setExportStatus(null); setShowImportCsv(false) }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showExport ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-800'}`}
        >
          Export
        </button>
        <button
          onClick={() => { setShowImportCsv(b => !b); setImportCsvResults([]); setImportCsvProgress(null); setShowExport(false) }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${showImportCsv ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-800'}`}
        >
          Import CSV
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="mb-4 bg-stone-900 border border-stone-700 rounded-xl p-4 flex items-center gap-3 flex-wrap">
          <span className="text-stone-500 text-sm">Cards added since</span>
          <input
            type="date"
            value={exportSince}
            onChange={e => { setExportSince(e.target.value); setExportStatus(null) }}
            className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 focus:outline-none focus:border-amber-600 transition-colors"
          />
          <button
            onClick={copyExport}
            className="px-4 py-1.5 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 text-amber-200 rounded-lg text-sm font-medium transition-colors"
          >
            Copy for Moxfield
          </button>
          {exportStatus && <span className="text-sm text-stone-400">{exportStatus}</span>}
        </div>
      )}

      {/* Import CSV panel */}
      {showImportCsv && (
        <div className="mb-4 bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-stone-500 text-xs">Reads the latest Moxfield haves CSV from disk. Skips proxies, playtests, and cards already in the binder. Only imports cards ≥ $2.00.</p>
          {importCsvProgress && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: `${(importCsvProgress.current / importCsvProgress.total) * 100}%` }} />
              </div>
              <span className="text-stone-500 text-xs shrink-0">{importCsvProgress.current}/{importCsvProgress.total}</span>
            </div>
          )}
          {importCsvResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
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
          <div className="flex gap-2">
            <button
              onClick={importFromCsv}
              disabled={importCsvLoading}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 rounded-lg text-sm font-medium text-amber-100 transition-colors"
            >
              {importCsvLoading ? 'Importing...' : 'Import from Moxfield CSV'}
            </button>
            {!importCsvLoading && importCsvResults.length > 0 && (
              <button
                onClick={() => { setImportCsvResults([]); setImportCsvProgress(null); setShowImportCsv(false) }}
                className="px-4 py-2 text-stone-500 hover:text-stone-300 text-sm transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add card input */}
          <div className="relative mb-6">
            <div className="flex gap-2">
              <input
                value={addQuery}
                onChange={e => handleAddInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !showDropdown) addCard(); if (e.key === 'Escape') setShowDropdown(false) }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onFocus={() => addCandidates.length > 0 && setShowDropdown(true)}
                placeholder="Add a card to binder..."
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
              />
              <input
                value={addNote}
                onChange={e => setAddNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCard() }}
                placeholder="Note (optional)"
                className="hidden sm:block w-40 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600 transition-colors"
              />
              <button
                onClick={() => addCard()}
                disabled={addLoading}
                className="px-4 py-2.5 bg-amber-950/60 border-2 border-amber-700/50 hover:bg-amber-900/60 hover:border-2 hover:border-amber-600 text-amber-200 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {addLoading ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowBulk(b => !b); setBulkResults([]); setBulkProgress(null) }}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${showBulk ? 'border-amber-700 text-amber-500 bg-amber-950/30' : 'border-stone-700 text-stone-500 hover:text-stone-300 bg-stone-800'}`}
              >
                Bulk
              </button>
            </div>

            {/* Bulk import panel */}
            {showBulk && (
              <div className="mt-2 bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-col gap-3">
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
                <div className="flex gap-2">
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

            {showDropdown && addCandidates.length > 0 && (
              <div className="absolute z-40 top-full left-0 right-12 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl">
                {addCandidates.map(c => (
                  <button
                    key={`${c.name}-${c.setCode}`}
                    onMouseDown={(e) => { e.preventDefault(); selectNameForPrinting(c.name) }}
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
            {showDropdown && addPrintings.length > 0 && (
              <div className="absolute z-40 top-full left-0 right-12 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto">
                <div className="px-4 py-2 border-b border-stone-800 flex items-center gap-2 sticky top-0 bg-stone-900">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setAddPrintings([]); setAddPrintingName(null); setShowDropdown(false) }}
                    className="text-stone-500 hover:text-stone-300 text-xs"
                  >← Back</button>
                  <span className="text-stone-400 text-xs font-medium">{addPrintingName} — choose printing</span>
                </div>
                {addPrintings.map(c => (
                  <button
                    key={`${c.name}-${c.setCode}-${c.collectorNumber}`}
                    onMouseDown={(e) => { e.preventDefault(); addCard(c.name, c.setCode, c.scryfallId) }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-800 transition-colors border-b border-stone-800 last:border-0 text-left"
                  >
                    {c.imageUrl
                      ? <img src={c.imageUrl} alt="" className="w-[146px] rounded-lg shrink-0" />
                      : <div className="w-[146px] h-[204px] bg-stone-800 rounded-lg shrink-0" />}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <p className="text-stone-100 text-sm font-semibold leading-snug">{c.setName}</p>
                      <p className="text-stone-500 text-xs">{c.setCode.toUpperCase()} · #{c.collectorNumber}</p>
                      {c.rarity && (
                        <p className={`text-xs capitalize font-medium ${
                          c.rarity === 'mythic' ? 'text-orange-400' :
                          c.rarity === 'rare' ? 'text-yellow-400' :
                          c.rarity === 'uncommon' ? 'text-blue-400' : 'text-stone-500'
                        }`}>{c.rarity}</p>
                      )}
                      {c.releasedAt && (
                        <p className="text-stone-600 text-xs">{c.releasedAt.slice(0, 4)}</p>
                      )}
                      <div className="mt-auto pt-2 flex flex-col gap-0.5">
                        {c.price != null
                          ? <span className="text-green-400 font-mono text-sm font-semibold">${c.price.toFixed(2)}</span>
                          : <span className="text-stone-600 font-mono text-sm">—</span>}
                        {c.foilPrice != null && (
                          <span className="text-amber-500 font-mono text-xs">${c.foilPrice.toFixed(2)} foil</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {addStatus && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
              addStatus.type === 'success'
                ? 'bg-green-900/30 border border-green-800 text-green-300'
                : 'bg-red-900/30 border border-red-800 text-red-300'
            }`}>
              {addStatus.message}
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

          {/* Sell suggestions — collapsible */}
          {showSellSuggestions && sellSuggestions.length > 0 && (
            <div className="mb-6 bg-red-950/40 border border-red-800/60 rounded-xl p-4">
              <div className="flex flex-wrap gap-3">
                {sellSuggestions.map(r => {
                  const lost = r.currentPrice != null ? r.currentPrice - r.snapshotPrice : null
                  return (
                    <div key={r.displayName} className="bg-red-950/50 border border-red-800/40 rounded-lg px-3 py-2">
                      <p className="text-stone-200 text-sm font-medium">{r.displayName}</p>
                      <p className="text-red-400 text-xs font-mono mt-0.5">
                        ${r.snapshotPrice.toFixed(2)} → ${r.currentPrice?.toFixed(2)} ({pctLabel(r.pct)})
                        {lost != null && <span className="ml-1 text-red-500">${lost.toFixed(2)}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
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
          {entries.length > 0 && <><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <button
                onClick={() => setGainersOpen(o => !o)}
                className="w-full flex items-center gap-2 mb-3 text-left"
              >
                <span className="text-green-400 font-semibold">▲ Gainers</span>
                {gainers.length > 0 && <span className="text-stone-600 font-normal text-sm">{gainers.length} cards</span>}
                {!gainersOpen && gainersDelta > 0 && (
                  <span className="ml-auto text-green-400 font-mono text-sm font-semibold">+${gainersDelta.toFixed(2)}</span>
                )}
                <span className="text-stone-400 text-sm ml-auto">{gainersOpen ? '▲' : '▼'}</span>
              </button>
              {gainersOpen && (
                <CardTable
                  rows={gainers}

                  onDelete={requestDelete}
                  emptyLabel={results.size === 0 ? 'Loading...' : 'No gainers'}
                  pendingDelete={pendingDelete}
                />
              )}
            </div>
            <div>
              <button
                onClick={() => setLosersOpen(o => !o)}
                className="w-full flex items-center gap-2 mb-3 text-left"
              >
                <span className="text-red-400 font-semibold">▼ Losers</span>
                {losers.length > 0 && <span className="text-stone-600 font-normal text-sm">{losers.length} cards</span>}
                {!losersOpen && losersDelta < 0 && (
                  <span className="ml-auto text-red-400 font-mono text-sm font-semibold">-${Math.abs(losersDelta).toFixed(2)}</span>
                )}
                <span className="text-stone-400 text-sm ml-auto">{losersOpen ? '▲' : '▼'}</span>
              </button>
              {losersOpen && (
                <CardTable
                  rows={losers}

                  onDelete={requestDelete}
                  emptyLabel={results.size === 0 ? 'Loading...' : 'No losers'}
                  pendingDelete={pendingDelete}
                />
              )}
            </div>
          </div>

          {/* Flat cards */}
          {flat.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setFlatOpen(o => !o)}
                className={`w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl border border-stone-800 bg-stone-900 hover:border-stone-700 hover:bg-stone-800/60 transition-colors ${flatOpen ? 'rounded-b-none mb-0' : 'mb-0'}`}
              >
                <span className="text-stone-400 font-semibold text-sm">Unchanged</span>
                <span className="text-stone-600 font-normal text-sm">{flat.length} cards</span>
                <span className="text-stone-600 text-xs ml-auto">{flatOpen ? '▲' : '▼'}</span>
              </button>
              {flatOpen && (
                <div className="bg-stone-900 border border-stone-800 border-t-0 rounded-b-xl overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {flat.map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-r border-stone-800 last:border-b-0">
                        <span className="text-sm text-stone-300 truncate">{row.displayName}</span>
                        <span className="text-sm text-stone-500 shrink-0">${(row.currentPrice ?? row.snapshotPrice).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
