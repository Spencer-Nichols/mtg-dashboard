'use client'

import { useState } from 'react'
import type { CardView } from '@/lib/league/views'
import LeagueModal, { leagueAction, ModalError, PrimaryButton } from './LeagueModal'

interface AddToBinderModalProps {
  cards: CardView[]
  importEnabled: boolean
  onClose: () => void
  onDone: () => void
}

interface ImportResult {
  name: string
  status: 'added' | 'skipped' | 'error'
  message?: string
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

export default function AddToBinderModal({ cards, importEnabled, onClose, onDone }: AddToBinderModalProps) {
  const [minPrice, setMinPrice] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)

  const min = parseFloat(minPrice)
  const threshold = Number.isFinite(min) ? min : 0
  const pending = cards.filter(c => !c.addedToBinder)
  const picked = pending.filter(c => (c.price ?? 0) >= threshold).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
  const total = picked.reduce((s, c) => s + (c.price ?? 0), 0)

  async function runImport() {
    setBusy(true)
    setError(null)
    setResults([])
    try {
      const res = await fetch('/api/binder/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: picked.map(c => c.binderLine), minPrice: threshold || undefined }),
      })
      if (!res.body) throw new Error('No response from the binder import')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const data = JSON.parse(evt.replace(/^data: /, ''))
          if (data.type === 'result') setResults(prev => [...(prev ?? []), data])
          if (data.type === 'error') throw new Error(data.message)
        }
      }
      await leagueAction({ action: 'markAddedToBinder', cardIds: picked.map(c => c.id) })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const finished = results != null && !busy

  return (
    <LeagueModal title="Add league cards to your binder" busy={busy} onClose={finished ? onDone : onClose}>
      <ModalError error={error} />
      {!importEnabled && (
        <p className="text-xs text-yellow-200 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2">
          Preview only while the league runs on mock data, so test cards don&apos;t land in your real binder.
        </p>
      )}

      {results == null ? (
        <>
          <label className="flex items-center gap-2 text-sm text-stone-300">
            Only cards worth at least
            <span className="flex items-center gap-1">
              <span className="text-stone-500">$</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-sm font-mono text-stone-100 focus:outline-none focus:border-amber-600"
              />
            </span>
          </label>
          <p className="text-sm text-stone-400">
            {picked.length} of {pending.length} cards · {money(total)} · cards already in your binder are skipped
          </p>
          <div className="bg-stone-950 border border-stone-800 rounded-xl max-h-72 overflow-y-auto">
            {picked.length === 0 && <p className="px-3 py-2.5 text-sm text-stone-500">No cards at that price</p>}
            {picked.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-stone-900 last:border-b-0 text-sm">
                <span className="min-w-0 truncate text-stone-200">{c.name}{c.printing ? <span className="text-stone-500"> · {c.printing}</span> : null}</span>
                <span className="font-mono text-stone-300 shrink-0">{c.price != null ? money(c.price) : '—'}</span>
              </div>
            ))}
          </div>
          <PrimaryButton onClick={runImport} disabled={!importEnabled || busy || picked.length === 0}>
            Add {picked.length} card{picked.length === 1 ? '' : 's'} to binder
          </PrimaryButton>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-300">
            {busy ? `Adding… ${results.length} of ${picked.length}` : `${results.filter(r => r.status === 'added').length} added · ${results.filter(r => r.status === 'skipped').length} skipped · ${results.filter(r => r.status === 'error').length} failed`}
          </p>
          <div className="bg-stone-950 border border-stone-800 rounded-xl max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-stone-900 last:border-b-0 text-sm">
                <span className="min-w-0 truncate text-stone-200">{r.name}</span>
                <span className={`text-xs shrink-0 ${r.status === 'added' ? 'text-green-300' : r.status === 'skipped' ? 'text-stone-400' : 'text-red-300'}`}>
                  {r.status === 'added' ? 'Added' : r.message ?? r.status}
                </span>
              </div>
            ))}
          </div>
          {finished && <PrimaryButton onClick={onDone}>Done</PrimaryButton>}
        </>
      )}
    </LeagueModal>
  )
}
