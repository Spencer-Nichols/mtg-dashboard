'use client'

import { useEffect, useState } from 'react'

interface Precon {
  id: string
  name: string
  commander: string
  moxfieldUrl: string | null
  takenBy: string | null
}

export default function DeckUpload({ onDone }: { onDone: () => void }) {
  const [precons, setPrecons] = useState<Precon[]>([])
  const [preconId, setPreconId] = useState<string | null>(null)
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
        body: JSON.stringify({ preconId }),
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
        <h2 className="text-lg font-bold text-stone-100">Upload your deck</h2>
        <p className="text-sm text-stone-400">Pick your Star Trek precon.</p>
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

      <div className="flex gap-2">
        <button
          onClick={upload}
          disabled={busy || !preconId}
          className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-amber-950/60 border border-amber-700/50 hover:bg-amber-900/60 text-amber-200 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Checking cards…' : 'Upload deck'}
        </button>
      </div>
    </section>
  )
}
