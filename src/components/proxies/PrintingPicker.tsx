'use client'

import { useEffect, useState } from 'react'
import LeagueModal, { ModalError, PrimaryButton } from '@/components/league/LeagueModal'

export interface ProxyCard {
  id: string
  board: 'commander' | 'main' | 'sideboard'
  qty: number
  name: string
  setCode: string | null
  collectorNumber: string | null
  scryfallId: string | null
  imageUrl: string | null
}

export interface Printing {
  scryfallId: string
  name: string
  setCode: string
  setName: string
  collectorNumber: string
  imageUrl: string | null
  label: string
}

interface PrintingPickerProps {
  card: ProxyCard
  onClose: () => void
  onPick: (printing: Printing) => Promise<void>
  saveNote?: string
}

export default function PrintingPicker({ card, onClose, onPick, saveNote = 'Saves to this deck right away' }: PrintingPickerProps) {
  const [searchName, setSearchName] = useState(card.name)
  const [nameInput, setNameInput] = useState(card.name)
  const [printings, setPrintings] = useState<Printing[] | null>(null)
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/proxies/printings?name=${encodeURIComponent(searchName)}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Could not load printings')
        if (!cancelled) setPrintings(data.printings)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [searchName])

  function search() {
    const next = nameInput.trim()
    if (!next || next === searchName) return
    setPrintings(null)
    setPicked(null)
    setError(null)
    setSearchName(next)
  }

  async function save() {
    const printing = printings?.find(p => p.scryfallId === picked)
    if (!printing) return
    setBusy(true)
    setError(null)
    try {
      await onPick(printing)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const unresolved = !card.scryfallId
  const term = filter.trim().toLowerCase()
  const shown = (printings ?? []).filter(p => !term
    || p.setCode.toLowerCase().includes(term)
    || p.setName.toLowerCase().includes(term)
    || p.collectorNumber.toLowerCase() === term
    || p.label.toLowerCase().includes(term))
  const pickedPrinting = printings?.find(p => p.scryfallId === picked)
  const current = card.setCode ? `${card.setCode.toUpperCase()} ${card.collectorNumber ?? ''}`.trim() : null

  return (
    <LeagueModal title={unresolved ? `Find "${card.name}"` : card.name} size="lg" busy={busy} onClose={onClose}>
      <ModalError error={error} />

      {unresolved && (
        <div id="proxy-fix-name" className="flex flex-col gap-1.5">
          <label htmlFor="proxy-name" className="text-xs text-stone-500 uppercase tracking-wider">Card name</label>
          <div className="flex gap-2">
            <input
              id="proxy-name"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') search() }}
              className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-base text-stone-100 focus:outline-none focus:border-amber-600"
            />
            <button type="button" onClick={search} className="px-4 rounded-lg border border-stone-700 text-sm text-stone-200 hover:border-stone-500">Search</button>
          </div>
          <p className="text-xs text-stone-500">Scryfall didn&apos;t recognize this name. Fix the spelling and search again.</p>
        </div>
      )}

      {!unresolved && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-400">{printings ? `${printings.length} printings` : 'Loading printings…'}{current && <> · current: <span className="font-mono">{current}</span></>}</p>
          <label htmlFor="proxy-filter" className="sr-only">Filter printings</label>
          <input
            id="proxy-filter"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by set or style"
            className="w-full sm:w-56 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-base sm:text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-600"
          />
        </div>
      )}

      {printings && shown.length === 0 && <p className="text-sm text-stone-500">No printings match.</p>}
      {unresolved && !printings && !error && <p className="text-sm text-stone-500">Loading printings…</p>}

      <div id="proxy-printings" className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
        {shown.map(p => {
          const isCurrent = p.scryfallId === card.scryfallId
          const isPicked = p.scryfallId === picked
          const ring = isPicked ? 'border-amber-500' : isCurrent ? 'border-dashed border-stone-500' : 'border-transparent hover:border-stone-600'
          return (
            <button
              key={p.scryfallId}
              type="button"
              aria-pressed={isPicked}
              onClick={() => setPicked(isCurrent ? null : p.scryfallId)}
              className={`flex flex-col gap-1 p-1 rounded-lg border-2 text-left ${ring}`}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={`${p.name} ${p.setCode.toUpperCase()} ${p.collectorNumber}`} loading="lazy" className="w-full aspect-[63/88] rounded-md bg-stone-800 object-cover" />
              ) : (
                <span className="w-full aspect-[63/88] rounded-md bg-stone-800" />
              )}
              <span className="text-[11px] font-mono text-stone-300 truncate">{p.setCode.toUpperCase()} {p.collectorNumber}</span>
              {p.label && <span className="text-[10px] text-yellow-300 truncate">{p.label}</span>}
            </button>
          )
        })}
      </div>

      <div className="sticky -bottom-5 -mx-5 -mb-5 px-5 pt-3 pb-5 bg-stone-900 border-t border-stone-800 flex flex-col gap-1.5">
        <PrimaryButton onClick={save} disabled={!picked || busy}>
          {busy ? 'Saving…' : pickedPrinting ? `Use ${pickedPrinting.setCode.toUpperCase()} ${pickedPrinting.collectorNumber}` : 'Pick a printing'}
        </PrimaryButton>
        <p className="text-center text-xs text-stone-500">{saveNote}</p>
      </div>
    </LeagueModal>
  )
}
