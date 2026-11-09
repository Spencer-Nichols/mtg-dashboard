'use client'

import { useState } from 'react'
import PrintingPicker, { type Printing, type ProxyCard } from '@/components/proxies/PrintingPicker'
import { buildProxyZip, type ProxySlot } from '@/lib/proxy-export'

type ExportState =
  | { phase: 'faces' }
  | { phase: 'images'; done: number; total: number }
  | { phase: 'done'; fileName: string; cardCount: number; skipped: number }
  | { phase: 'error'; message: string }

const BOARD_ORDER = { commander: 0, main: 1, sideboard: 2 }

interface ProxyReviewProps {
  header: React.ReactNode
  cards: ProxyCard[]
  exportName: string
  pickNote: string
  phoneNote: string
  onPick: (card: ProxyCard, printing: Printing) => Promise<void>
}

// The card grid, printing picker and zip export shared by saved decks and quick lists.
export default function ProxyReview({ header, cards, exportName, pickNote, phoneNote, onPick }: ProxyReviewProps) {
  const [picking, setPicking] = useState<ProxyCard | null>(null)
  const [exportState, setExportState] = useState<ExportState | null>(null)
  const [includeSideboard, setIncludeSideboard] = useState(false)

  const printable = cards
    .filter(c => includeSideboard || c.board !== 'sideboard')
    .sort((a, b) => BOARD_ORDER[a.board] - BOARD_ORDER[b.board] || a.name.localeCompare(b.name))
  const needsPick = printable.filter(c => !c.scryfallId)
  const ready = printable.filter(c => c.scryfallId)
  const readyCount = ready.reduce((n, c) => n + c.qty, 0)
  const sideboardCount = cards.filter(c => c.board === 'sideboard').reduce((n, c) => n + c.qty, 0)
  const exporting = exportState?.phase === 'faces' || exportState?.phase === 'images'

  async function exportZip() {
    setExportState({ phase: 'faces' })
    try {
      const res = await fetch('/api/proxies/faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ready.map(c => c.scryfallId) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not look up card images')
      const faces: Record<string, ProxySlot> = data.faces
      const slots = ready.flatMap(c => {
        const face = faces[c.scryfallId!]
        return face ? Array.from({ length: c.qty }, () => face) : []
      })
      const skipped = readyCount - slots.length
      const result = await buildProxyZip(exportName, slots, (done, total) => setExportState({ phase: 'images', done, total }))
      setExportState({ phase: 'done', ...result, skipped })
    } catch (e) {
      console.error('Proxy export failed:', e)
      setExportState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  async function pick(card: ProxyCard, printing: Printing) {
    await onPick(card, printing)
    setPicking(null)
    setExportState(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <header id="proxy-header" className="flex flex-col gap-1">
        {header}
        <p className="text-sm text-stone-400">
          {readyCount} cards ready
          {needsPick.length > 0 && <> · <span className="text-orange-300">{needsPick.length} need a pick</span></>}
        </p>
        <p className="mt-1 self-start text-xs text-sky-200 bg-sky-950/40 border border-sky-900/60 rounded-lg px-2.5 py-1.5">
          Real card art only: the official Scryfall printing you choose. No custom or fan-made art.
        </p>
        {sideboardCount > 0 && (
          <label id="proxy-include-sideboard" className="self-start flex items-center gap-2 min-h-11 text-sm text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSideboard}
              onChange={e => { setIncludeSideboard(e.target.checked); setExportState(null) }}
              className="w-5 h-5 accent-amber-500"
            />
            Include sideboard ({sideboardCount})
          </label>
        )}
      </header>

      {needsPick.length > 0 && (
        <section id="proxy-needs-pick" className="bg-stone-900 border border-orange-900/70 rounded-xl overflow-hidden">
          {needsPick.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-stone-800 last:border-0">
              <span className="flex-1 min-w-0 text-sm">
                <strong className="text-stone-100">{c.name}</strong>
                {c.setCode && <span className="text-stone-500 font-mono"> ({c.setCode.toUpperCase()}) {c.collectorNumber}</span>}
                <span className="block sm:inline text-orange-300"> · Scryfall didn&apos;t find this card</span>
              </span>
              <button
                onClick={() => setPicking(c)}
                className="min-h-10 px-3 rounded-lg border border-amber-700/60 bg-amber-950/50 text-amber-200 text-sm font-semibold hover:bg-amber-900/60 cursor-pointer"
              >
                Fix name
              </button>
            </div>
          ))}
        </section>
      )}

      <section id="proxy-cards" className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
        {ready.map(c => (
          <button key={c.id} onClick={() => setPicking(c)} className="flex flex-col gap-1 text-left group cursor-pointer">
            <span className="relative block">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.name} loading="lazy" className="w-full aspect-[63/88] rounded-lg bg-stone-800 object-cover border border-stone-800 group-hover:border-amber-700/70 transition-colors" />
              ) : (
                <span className="block w-full aspect-[63/88] rounded-lg bg-stone-800" />
              )}
              {c.qty > 1 && <span className="absolute top-1.5 right-1.5 text-xs font-bold bg-stone-950/90 text-amber-200 rounded-full px-2 py-0.5">×{c.qty}</span>}
              {c.board === 'commander' && <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-amber-950/90 text-amber-200 border border-amber-800 rounded-full px-2 py-0.5">Commander</span>}
              {c.board === 'sideboard' && <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-stone-950/90 text-green-200 border border-green-900 rounded-full px-2 py-0.5">Sideboard</span>}
            </span>
            <span className="text-xs text-stone-200 truncate">{c.name}</span>
            <span className="text-[11px] text-stone-500 font-mono">{c.setCode?.toUpperCase()} {c.collectorNumber}</span>
          </button>
        ))}
      </section>
      <p className="text-xs text-stone-500 -mt-3">Tap a card to swap its printing.</p>

      <section id="proxy-export" className="sticky bottom-0 -mx-4 sm:mx-0 border-t sm:border border-stone-800 sm:rounded-xl bg-stone-950/95 backdrop-blur px-4 py-4 flex flex-col gap-3">
        <div className="sm:hidden flex items-start gap-3">
          <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-sky-300 shrink-0"><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></svg>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-sky-100">Export on your computer</span>
            <span className="text-xs text-sky-200/90">{phoneNote}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ExportStatus state={exportState} />
          <button
            onClick={exportZip}
            disabled={exporting || readyCount === 0}
            className="hidden sm:inline-flex min-h-11 items-center px-5 rounded-lg bg-amber-500 text-stone-950 text-sm font-bold hover:bg-amber-400 disabled:opacity-50 cursor-pointer disabled:cursor-default"
          >
            {exporting ? 'Building zip…' : `Export zip · ${readyCount} cards`}
          </button>
          <button
            onClick={exportZip}
            disabled={exporting || readyCount === 0}
            className="sm:hidden w-full text-center text-xs text-stone-400 underline disabled:opacity-50 py-1"
          >
            {exporting ? 'Building zip…' : 'Download the zip here anyway'}
          </button>
        </div>
      </section>

      {picking && (
        <PrintingPicker
          card={picking}
          saveNote={pickNote}
          onClose={() => setPicking(null)}
          onPick={printing => pick(picking, printing)}
        />
      )}
    </div>
  )
}

function ExportStatus({ state }: { state: ExportState | null }) {
  if (!state) {
    return <p className="hidden sm:block text-xs text-stone-500">Downloads one zip for tcgplaytest: FRONT and BACK folders, black bleed, proxy back on every single-faced card.</p>
  }
  if (state.phase === 'faces') return <p className="text-sm text-stone-300">Looking up card images…</p>
  if (state.phase === 'images') {
    const percent = state.total ? Math.round((state.done / state.total) * 100) : 0
    return (
      <div className="flex-1 min-w-48 flex flex-col gap-1.5">
        <p className="text-sm text-stone-300">Downloading art {state.done} / {state.total}</p>
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-stone-800 overflow-hidden">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }
  if (state.phase === 'error') return <p className="text-sm text-red-400">Export failed: {state.message}</p>
  return (
    <p className="text-sm text-green-300">
      {state.fileName} downloaded · {state.cardCount} cards. Upload it to tcgplaytest as is.
      {state.skipped > 0 && <span className="text-orange-300"> {state.skipped} skipped: Scryfall had no image.</span>}
    </p>
  )
}
