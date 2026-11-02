'use client'

import { useEffect, useState } from 'react'
import { LEAGUE_EMAIL_TYPES, type LeagueEmailType } from '@/lib/league/email-types'

type Prefs = Partial<Record<LeagueEmailType, boolean>>

export default function LeagueEmailSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(d => setPrefs(d?.leagueEmails ?? {}))
  }, [])

  async function toggle(type: LeagueEmailType) {
    const next = !(prefs?.[type] ?? true)
    setPrefs({ ...prefs, [type]: next })
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueEmails: { [type]: next } }),
    })
  }

  if (!prefs) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Email me when</h2>
      <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {(Object.keys(LEAGUE_EMAIL_TYPES) as LeagueEmailType[]).map(type => (
          <label key={type} className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
            <input type="checkbox" checked={prefs[type] ?? true} onChange={() => toggle(type)} className="accent-amber-600" />
            {LEAGUE_EMAIL_TYPES[type]}
          </label>
        ))}
      </div>
    </section>
  )
}
