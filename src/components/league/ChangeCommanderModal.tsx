'use client'

import { useState } from 'react'
import LeagueModal, { leagueAction, ModalError, PrimaryButton } from './LeagueModal'

interface ChangeCommanderModalProps {
  current: string
  options: { id: string; name: string; imageUrl: string | null }[]
  onClose: () => void
  onChanged: () => void
}

export default function ChangeCommanderModal({ current, options, onClose, onChanged }: ChangeCommanderModalProps) {
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await leagueAction({ action: 'changeCommander', cardId: pick })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <LeagueModal title="Change commander" size="lg" busy={busy} onClose={onClose}>
      <p className="text-sm text-stone-400">
        {current} moves into your main deck. Only legends from your precon that cover all of your deck&apos;s colors can lead it.
      </p>
      <ModalError error={error} />
      <div className="flex flex-wrap justify-center gap-4">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            aria-pressed={pick === o.id}
            onClick={() => setPick(o.id)}
            className="w-48 sm:w-72 flex flex-col gap-1 text-left"
          >
            <div className={`relative w-full aspect-[5/7] bg-stone-800 rounded-xl overflow-hidden border-2 transition-colors ${pick === o.id ? 'border-amber-500' : 'border-stone-800 hover:border-amber-700/70'}`}>
              {o.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-stone-400">{o.name}</span>
              )}
            </div>
            <span className={`text-sm truncate px-0.5 ${pick === o.id ? 'text-amber-300' : 'text-stone-400'}`}>{o.name}</span>
          </button>
        ))}
      </div>
      <PrimaryButton onClick={save} disabled={!pick || busy}>
        {busy ? 'Saving…' : 'Make commander'}
      </PrimaryButton>
    </LeagueModal>
  )
}
