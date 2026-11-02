'use client'

import { useState } from 'react'

interface NextGameProps {
  gameNumber: number
  at: string | null
  note: string | null
  timeZone: string
  canSchedule: boolean
  changeCount: number
  boostNote: string
  onSave: (at: string | null, note: string) => Promise<void>
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NextGame({ gameNumber, at, note, timeZone, canSchedule, changeCount, boostNote, onSave }: NextGameProps) {
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState(toLocalInput(at))
  const [text, setText] = useState(note ?? '')
  const [busy, setBusy] = useState(false)

  const label = at
    ? new Date(at).toLocaleString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'No date set yet'

  async function save(clear = false) {
    setBusy(true)
    await onSave(clear || !when ? null : new Date(when).toISOString(), text)
    setBusy(false)
    setEditing(false)
  }

  return (
    <div className="bg-stone-900 border-2 border-amber-900/40 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Next up · Game {gameNumber}</p>
      <p className="text-stone-100">{label}</p>
      {note && <p className="text-xs text-stone-300">{note}</p>}
      {(changeCount > 0 || boostNote) && (
        <p className="text-xs text-stone-400">
          {changeCount > 0 ? `${changeCount} deck change${changeCount === 1 ? '' : 's'} to announce` : ''}{changeCount > 0 ? boostNote : boostNote.replace(/^ · /, '')}
        </p>
      )}
      {canSchedule && !editing && (
        <button onClick={() => setEditing(true)} className="self-start text-sm font-semibold text-amber-400 hover:text-amber-300">
          {at ? 'Change date' : 'Set date'}
        </button>
      )}
      {editing && (
        <div className="flex flex-col gap-2 mt-1">
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Date and time
            <input
              type="datetime-local"
              value={when}
              onChange={e => setWhen(e.target.value)}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Note (optional)
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={120}
              placeholder="Where you're playing"
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 placeholder-stone-600"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save()} disabled={busy || !when} className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-950/60 border border-amber-700/50 text-amber-200 disabled:opacity-50">
              {busy ? 'Saving…' : 'Save and email everyone'}
            </button>
            {at && (
              <button onClick={() => save(true)} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold border border-stone-700 text-stone-300">
                Clear date
              </button>
            )}
            <button onClick={() => setEditing(false)} disabled={busy} className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
