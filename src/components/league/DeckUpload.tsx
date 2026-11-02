'use client'

import { useEffect, useState } from 'react'

interface Precon {
  id: string
  name: string
  commander: string
  moxfieldUrl: string | null
  takenBy: string | null
}

export default function DeckUpload({ replacing, onDone, onCancel }: { replacing: boolean; onDone: () => void; onCancel?: () => void }) {
  const [precons, setPrecons] = useState<Precon[]>([])
  const [preconId, setPreconId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [deckName, setDeckName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/league/decklist').then(r => r.ok ? r.json() : []).then(setPrecons)
  }, [])

  async function upload() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/league/decklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preconId ? { preconId } : { text, deckName }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Upload failed')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <section className="bg-stone-900 border-2 border-amber-900/40 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-stone-100">{replacing ? 'Replace your deck' : 'Upload your deck'}</h2>
        <p className="text-sm text-stone-400">
          {replacing ? 'You can swap lists until game 1 or your first swap or trade.' : 'Pick your Star Trek precon, or paste your list from Moxfield.'}
        </p>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>}

      {precons.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-stone-500 uppercase tracking-wider">Star Trek precons</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {precons.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preconId === p.id}
                disabled={!!p.takenBy}
                onClick={() => setPreconId(preconId === p.id ? null : p.id)}
                className={`text-left px-3 py-3 rounded-xl border transition-colors disabled:opacity-40 ${preconId === p.id ? 'bg-amber-950/60 border-amber-700/70' : 'border-stone-700 hover:border-stone-500'}`}
              >
                <span className="block text-sm font-semibold text-stone-100">{p.name}</span>
                <span className="block text-xs text-stone-400">{p.takenBy ? `Taken by ${p.takenBy}` : p.commander}</span>
              </button>
            ))}
          </div>
          {preconId && precons.find(p => p.id === preconId)?.moxfieldUrl && (
            <a href={precons.find(p => p.id === preconId)!.moxfieldUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:text-amber-400">
              View this list on Moxfield ↗
            </a>
          )}
        </div>
      )}

      {!preconId && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="deck-name" className="text-xs text-stone-500 uppercase tracking-wider">Deck name</label>
            <input
              id="deck-name"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="Which precon is it?"
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="deck-list" className="text-xs text-stone-500 uppercase tracking-wider">Decklist</label>
            <textarea
              id="deck-list"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={'1 Your Commander (TRC) 1\n\n1 Sol Ring (TRC) 250\n…'}
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-sm font-mono text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
            />
            <p className="text-xs text-stone-500">In Moxfield: Export → Copy for Moxfield. Put your commander in its own block at the top. Exactly 100 cards.</p>
          </div>
        </>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} disabled={busy} className="px-4 py-3 rounded-xl text-sm font-medium border border-stone-700 text-stone-300 hover:border-stone-500 disabled:opacity-50">
            Cancel
          </button>
        )}
        <button
          onClick={upload}
          disabled={busy || (!preconId && !text.trim())}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Checking cards…' : replacing ? 'Replace deck' : 'Upload deck'}
        </button>
      </div>
    </section>
  )
}
