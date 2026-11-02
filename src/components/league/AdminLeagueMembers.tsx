'use client'

import { useEffect, useState } from 'react'

interface Seat {
  id: string
  name: string
  email: string | null
  role: 'player' | 'commissioner'
}

interface LeagueAdmin {
  seasonNumber: number | null
  status: 'active' | 'ended' | null
  seats: Seat[]
}

export default function AdminLeagueMembers({ userEmails }: { userEmails: string[] }) {
  const [league, setLeague] = useState<LeagueAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [wipeText, setWipeText] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/league')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Could not load the league')
        setLeague(d)
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function save(memberId: string, changes: Partial<Seat>) {
    setSaving(memberId)
    setError(null)
    const res = await fetch('/api/admin/league', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ...changes }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setLeague(d)
    else setError(d.error ?? 'Failed to save')
    setSaving(null)
  }

  async function startSeason() {
    setSaving('season')
    setError(null)
    const res = await fetch('/api/admin/league', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setLeague(d)
    else setError(d.error ?? 'Failed to start the season')
    setSaving(null)
  }

  async function wipe() {
    setSaving('wipe')
    setError(null)
    const res = await fetch('/api/admin/league', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: wipeText }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setLeague(d)
      setWipeText(null)
    } else {
      setError(d.error ?? 'Failed to wipe the league')
    }
    setSaving(null)
  }

  if (error && !league) return null
  const seats = league?.seats

  const taken = new Set((seats ?? []).map(s => s.email?.toLowerCase()).filter(Boolean))

  return (
    <section className="flex flex-col gap-2">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-stone-100">
            League members{league?.seasonNumber ? ` · season ${league.seasonNumber}${league.status === 'ended' ? ' (ended)' : ''}` : ''}
          </h2>
          {league && league.status !== 'active' && (
            <button
              onClick={startSeason}
              disabled={saving === 'season'}
              className="text-xs px-3 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
            >
              {saving === 'season' ? 'Starting…' : league.seasonNumber ? `Start season ${league.seasonNumber + 1}` : 'Start season 1'}
            </button>
          )}
        </div>
        <p className="text-sm text-stone-500">Give 4 existing users a seat. Commissioners can log games and end the season after the last game.</p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      {!seats ? (
        <p className="text-sm text-stone-600">Loading…</p>
      ) : seats.length === 0 ? (
        <p className="text-sm text-stone-500">No league yet. Start season 1 to create 4 empty seats.</p>
      ) : (
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {seats.map(seat => (
            <div key={seat.id} className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-stone-800 last:border-0">
              <input
                aria-label="Player name"
                defaultValue={seat.name}
                onBlur={e => { if (e.target.value.trim() && e.target.value !== seat.name) save(seat.id, { name: e.target.value }) }}
                className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-600"
              />
              <span className="relative flex-1 min-w-48">
                <select
                  aria-label={`User for ${seat.name}`}
                  value={seat.email ?? ''}
                  disabled={saving === seat.id}
                  onChange={e => save(seat.id, { email: e.target.value || null })}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-3 pr-8 py-2 text-sm text-stone-100 hover:border-stone-500 appearance-none cursor-pointer"
                >
                  <option value="">Empty seat</option>
                  {seat.email && !userEmails.some(e => e.toLowerCase() === seat.email) && <option value={seat.email}>{seat.email}</option>}
                  {userEmails
                    .filter(e => e.toLowerCase() === seat.email || !taken.has(e.toLowerCase()))
                    .map(e => <option key={e} value={e.toLowerCase()}>{e}</option>)}
                </select>
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"><path d="M6 9l6 6 6-6" /></svg>
              </span>
              <span className="relative">
                <select
                  aria-label={`Role for ${seat.name}`}
                  value={seat.role}
                  disabled={saving === seat.id}
                  onChange={e => save(seat.id, { role: e.target.value as Seat['role'] })}
                  className="bg-stone-800 border border-stone-700 rounded-lg pl-3 pr-8 py-2 text-sm text-stone-100 hover:border-stone-500 appearance-none cursor-pointer"
                >
                  <option value="player">Player</option>
                  <option value="commissioner">Commissioner</option>
                </select>
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
          ))}
        </div>
      )}
      {league && league.seasonNumber != null && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
                disabled={wipeText !== 'WIPE' || saving === 'wipe'}
                className="text-xs px-3 py-2 rounded border border-red-800 bg-red-950/50 text-red-200 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                {saving === 'wipe' ? 'Wiping…' : 'Wipe everything'}
              </button>
              <button onClick={() => setWipeText(null)} className="text-xs px-2 py-2 text-stone-400 hover:text-stone-200 cursor-pointer">Cancel</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
