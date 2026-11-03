'use client'

import { useState } from 'react'
import type { LeagueSettings } from '@/lib/league/types'

interface LeagueSettingsEditorProps {
  settings: LeagueSettings
  scoringLocked: boolean
  onSave: (changes: Partial<LeagueSettings>) => Promise<void>
}

const PLACES = ['1st', '2nd', '3rd', '4th']

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-500">
      {label}
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-sm font-mono text-stone-100 focus:outline-none focus:border-amber-600 disabled:opacity-50"
      />
    </label>
  )
}

export default function LeagueSettingsEditor({ settings, scoringLocked, onSave }: LeagueSettingsEditorProps) {
  const [draft, setDraft] = useState(settings)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof LeagueSettings>(key: K, value: LeagueSettings[K]) => setDraft({ ...draft, [key]: value })
  const setAt = (key: 'finishPoints' | 'prizePacks', i: number, n: number) => set(key, draft[key].map((v, j) => j === i ? n : v))
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  async function save() {
    setBusy(true)
    await onSave(draft)
    setBusy(false)
  }

  return (
    <div id="league-settings-editor" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-stone-500 sm:col-span-1">
          League name
          <input
            value={draft.name}
            maxLength={60}
            onChange={e => set('name', e.target.value)}
            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-600"
          />
        </label>
        <NumberField label="Games in the season" value={draft.totalGames} onChange={n => set('totalGames', n)} />
        <NumberField label="Trades per week with each player" value={draft.tradesPerPairPerWeek} onChange={n => set('tradesPerPairPerWeek', n)} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-400 font-semibold">Season prize packs</p>
        <div className="grid grid-cols-4 gap-2">
          {draft.prizePacks.map((v, i) => <NumberField key={i} label={PLACES[i]} value={v} onChange={n => setAt('prizePacks', i, n)} />)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-400 font-semibold">
          Scoring and packs{scoringLocked && <span className="font-normal text-stone-500"> · locked once game 1 is played</span>}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {draft.finishPoints.map((v, i) => <NumberField key={i} label={`${PLACES[i]} place`} value={v} disabled={scoringLocked} onChange={n => setAt('finishPoints', i, n)} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <NumberField label="First Blood" value={draft.firstBloodBonus} disabled={scoringLocked} onChange={n => set('firstBloodBonus', n)} />
          <NumberField label="Bounty" value={draft.bountyBonus} disabled={scoringLocked} onChange={n => set('bountyBonus', n)} />
          <NumberField label="Missed week" value={draft.missedPoints} disabled={scoringLocked} onChange={n => set('missedPoints', n)} />
          <NumberField label="Opening night packs" value={draft.openingPacks} disabled={scoringLocked} onChange={n => set('openingPacks', n)} />
          <NumberField label="Reserve packs" value={draft.reservePacks} disabled={scoringLocked} onChange={n => set('reservePacks', n)} />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!dirty || busy}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 hover:bg-amber-900/60 disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          {busy ? 'Saving…' : 'Save rules'}
        </button>
        {dirty && (
          <button onClick={() => setDraft(settings)} disabled={busy} className="px-3 py-2 text-sm text-stone-400 hover:text-stone-200 cursor-pointer">
            Undo changes
          </button>
        )}
      </div>
    </div>
  )
}
