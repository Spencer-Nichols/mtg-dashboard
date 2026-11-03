'use client'

import { useState } from 'react'

export default function AdminLeagueWipe() {
  const [wipeText, setWipeText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function wipe() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/league', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: wipeText }),
    })
    if (res.ok) {
      window.location.reload()
      return
    }
    const d = await res.json().catch(() => ({}))
    setError(d.error ?? 'Failed to wipe the league')
    setBusy(false)
  }

  return (
    <section id="admin-league-wipe" className="flex flex-wrap items-center gap-2 text-sm border-t border-stone-800 pt-4">
      {wipeText == null ? (
        <button onClick={() => setWipeText('')} className="text-xs px-3 py-1.5 rounded border border-red-900/70 text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer">
          Wipe league data
        </button>
      ) : (
        <>
          <p className="w-full text-xs text-red-300">Deletes every season, seat, deck, game, pack and trade. This can&apos;t be undone. Type WIPE to confirm.</p>
          <input
            aria-label="Type WIPE to confirm"
            value={wipeText}
            onChange={e => setWipeText(e.target.value)}
            className="w-28 bg-stone-800 border border-red-900/70 rounded-lg px-2 py-1.5 text-sm text-stone-100 focus:outline-none focus:border-red-600"
          />
          <button
            onClick={wipe}
            disabled={wipeText !== 'WIPE' || busy}
            className="text-xs px-3 py-2 rounded border border-red-800 bg-red-950/50 text-red-200 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {busy ? 'Wiping…' : 'Wipe everything'}
          </button>
          <button onClick={() => setWipeText(null)} className="text-xs px-2 py-2 text-stone-400 hover:text-stone-200 cursor-pointer">Cancel</button>
        </>
      )}
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </section>
  )
}
