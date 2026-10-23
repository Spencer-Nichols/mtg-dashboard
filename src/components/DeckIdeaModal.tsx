'use client'

import { useState } from 'react'

interface Preview {
  counts: { commander: number; main: number; sideboard: number }
  detectedCommanders: string[]
  commanderCandidates: string[]
  suggestedName: string
  unparsed: string[]
  unresolved: string[]
  diff: {
    added: { name: string; qty: number }[]
    removed: { name: string; qty: number }[]
    changed: { name: string; from: number; to: number }[]
  } | null
}

interface DeckIdeaModalProps {
  deckId?: string
  initialName?: string
  initialSourceUrl?: string | null
  onClose: () => void
  onSaved: (id: string) => void
}

const MAX_COMMANDERS = 2

export default function DeckIdeaModal({ deckId, initialName, initialSourceUrl, onClose, onSaved }: DeckIdeaModalProps) {
  const [text, setText] = useState('')
  const [name, setName] = useState(initialName ?? '')
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl ?? '')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [commanders, setCommanders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/deck-ideas/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, deckId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read that list')
      setPreview(data)
      setCommanders(data.detectedCommanders)
      if (!name.trim()) setName(data.suggestedName)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(deckId ? `/api/deck-ideas/${deckId}` : '/api/deck-ideas', {
        method: deckId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text, commanders, sourceUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save deck')
      onSaved(data.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function toggleCommander(card: string) {
    setCommanders(prev => prev.includes(card)
      ? prev.filter(c => c !== card)
      : prev.length < MAX_COMMANDERS ? [...prev, card] : prev)
  }

  const mainCount = preview ? preview.counts.main + preview.counts.commander - commanders.length : 0
  const diff = preview?.diff
  const diffEmpty = diff && diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape' && !busy) onClose() }}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0">
          <h2 className="text-stone-100 font-semibold truncate pr-4">{deckId ? 'Re-paste from Moxfield' : 'Add a deck idea'}</h2>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none shrink-0 disabled:opacity-50">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
          )}

          {!preview ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="deck-idea-list" className="text-xs text-stone-500 uppercase tracking-wider">Decklist</label>
                <textarea
                  id="deck-idea-list"
                  autoFocus
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={12}
                  placeholder={'1 Frodo, Adventurous Hobbit (LTC) 2 *F*\n1 Sam, Loyal Attendant (LTC) 7 *F*\n\n1 Arcane Signet (FDC) 245\n…'}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-sm font-mono text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                />
                <p className="text-xs text-stone-500">In Moxfield: Export → Copy for Moxfield. Put commanders in their own block at the top for best results.</p>
              </div>
              <button
                onClick={loadPreview}
                disabled={busy || !text.trim()}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Reading list…' : 'Next'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-300">
                {commanders.length} commander{commanders.length === 1 ? '' : 's'} · {mainCount} main · {preview.counts.sideboard} sideboard
              </p>

              {(preview.unresolved.length > 0 || preview.unparsed.length > 0) && (
                <div className="text-xs text-yellow-300 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2 flex flex-col gap-1">
                  {preview.unresolved.length > 0 && <p>Not found on Scryfall (saved without a price): {preview.unresolved.join(', ')}</p>}
                  {preview.unparsed.length > 0 && <p>Skipped lines: {preview.unparsed.join(' · ')}</p>}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="deck-idea-name" className="text-xs text-stone-500 uppercase tracking-wider">Deck name</label>
                <input
                  id="deck-idea-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                />
              </div>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs text-stone-500 uppercase tracking-wider mb-1">Commander(s)</legend>
                {preview.commanderCandidates.length === 0 ? (
                  <p className="text-xs text-stone-500">No legendary creatures found. The deck will be saved without a commander.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                    {preview.commanderCandidates.map(card => (
                      <label key={card} className="flex items-center gap-2 text-sm text-stone-200 bg-stone-800/60 rounded-lg px-3 py-2 cursor-pointer hover:bg-stone-800">
                        <input
                          type="checkbox"
                          checked={commanders.includes(card)}
                          disabled={!commanders.includes(card) && commanders.length >= MAX_COMMANDERS}
                          onChange={() => toggleCommander(card)}
                          className="accent-amber-600"
                        />
                        {card}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <div className="flex flex-col gap-1">
                <label htmlFor="deck-idea-url" className="text-xs text-stone-500 uppercase tracking-wider">Moxfield link</label>
                <input
                  id="deck-idea-url"
                  type="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="Optional"
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                />
              </div>

              {diff && (
                <div className="text-xs bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2 flex flex-col gap-1">
                  {diffEmpty ? (
                    <p className="text-stone-400">No card changes.</p>
                  ) : (
                    <>
                      <p className="text-stone-300 font-semibold">
                        +{diff.added.length} added · −{diff.removed.length} removed · {diff.changed.length} qty changed
                      </p>
                      {diff.added.length > 0 && <p className="text-green-400">+ {diff.added.map(c => c.name).join(', ')}</p>}
                      {diff.removed.length > 0 && <p className="text-red-400">− {diff.removed.map(c => c.name).join(', ')}</p>}
                      {diff.changed.length > 0 && <p className="text-stone-400">{diff.changed.map(c => `${c.name} ${c.from}→${c.to}`).join(', ')}</p>}
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  disabled={busy}
                  className="px-4 py-3 rounded-xl text-sm font-medium border border-stone-700 text-stone-300 hover:border-stone-500 disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={save}
                  disabled={busy || !name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Pricing deck…' : deckId ? 'Update deck' : 'Save deck'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
