'use client'

import { useEffect, useState } from 'react'
import type { LeagueSettings } from '@/lib/league/types'
import LeagueSettingsEditor from './LeagueSettingsEditor'

interface SettingsView {
  settings: LeagueSettings | null
  scoringLocked: boolean
  ended: boolean
}

export default function AdminLeagueSettings() {
  const [view, setView] = useState<SettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/league/settings')
      .then(r => r.ok ? r.json() : null)
      .then(setView)
  }, [])

  async function save(settings: Partial<LeagueSettings>) {
    setError(null)
    const res = await fetch('/api/admin/league/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setView(d)
    else setError(d.error ?? 'Failed to save the rules')
  }

  if (!view?.settings) return null

  return (
    <section id="admin-league-settings" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-stone-200">Rules</h3>
      <div className="flex flex-col gap-2">
        {view.ended && <p className="text-sm text-stone-500">The season has ended. Start a new season to change the rules.</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!view.ended && (
          <LeagueSettingsEditor
            key={JSON.stringify(view.settings)}
            settings={view.settings}
            scoringLocked={view.scoringLocked}
            onSave={save}
          />
        )}
      </div>
    </section>
  )
}
