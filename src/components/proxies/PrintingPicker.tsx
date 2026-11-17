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
  customImageUrls: Record<CustomSide, string | undefined>
  onCustomImage: (side: CustomSide, image: File) => Promise<void>
  onRemoveCustomImage: (side: CustomSide) => Promise<void>
  saveNote?: string
}

export type CustomSide = 'front' | 'back'

const CUSTOM_LABELS: Record<CustomSide, { add: string; replace: string; remove: string }> = {
  front: { add: 'Use Custom Image', replace: 'Replace Custom Image', remove: 'Back to Scryfall art' },
  back: { add: 'Custom back', replace: 'Replace custom back', remove: 'Back to normal back' },
}

export default function PrintingPicker({ card, onClose, onPick, customImageUrls, onCustomImage, onRemoveCustomImage, saveNote = 'Saves to this deck right away' }: PrintingPickerProps) {
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
      if (customImageUrls.front) await onRemoveCustomImage('front')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function runCustom(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      console.error('Custom image failed:', e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function pickFile(side: CustomSide, e: React.ChangeEvent<HTMLInputElement>) {
    const image = e.target.files?.[0]
    e.target.value = ''
    if (!image) return
    if (!image.type.startsWith('image/')) {
      setError('Pick a JPG or PNG image')
      return
    }
    runCustom(() => onCustomImage(side, image))
  }

  const unresolved = !card.scryfallId
  const term = filter.trim().toLowerCase()
  const shown = (printings ?? []).filter(p => !term
    || p.setCode.toLowerCase().includes(term)
    || p.setName.toLowerCase().includes(term)
    || p.collectorNumber.toLowerCase() === term
    || p.label.toLowerCase().includes(term))
  const pickedPrinting = printings?.find(p => p.scryfallId === picked)
  const customParts = [customImageUrls.front && 'Custom Image', customImageUrls.back && 'custom back'].filter(Boolean).join(' and ')
  const customNote = customParts ? `${customParts.charAt(0).toUpperCase()}${customParts.slice(1)} saved on this device` : null
  const current = customImageUrls.front
    ? 'Custom Image'
    : card.setCode ? `${card.setCode.toUpperCase()} ${card.collectorNumber ?? ''}`.trim() : null

  return (
    <LeagueModal title={unresolved ? `Find "${card.name}"` : card.name} size="lg" busy={busy} onClose={onClose}>
      <ModalError error={error} />

      <p className="sm:hidden text-xs text-stone-500">Add Custom Images on your computer, where you export the zip.</p>
      <div id="proxy-custom-image" className="hidden sm:flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {(['front', 'back'] as const).map(side => (
            <div key={side} className="inline-flex items-center gap-2">
              {side === 'back' && customImageUrls.back && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customImageUrls.back} alt="Your custom back" className="w-9 aspect-[63/88] rounded object-cover border border-sky-800" />
              )}
              <label className={`min-h-9 inline-flex items-center px-3 rounded-lg border border-stone-700 text-sm text-stone-200 hover:border-stone-500 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                {customImageUrls[side] ? CUSTOM_LABELS[side].replace : CUSTOM_LABELS[side].add}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pickFile(side, e)} disabled={busy} className="sr-only" />
              </label>
              {customImageUrls[side] && (
                <button type="button" onClick={() => runCustom(() => onRemoveCustomImage(side))} disabled={busy} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
                  {CUSTOM_LABELS[side].remove}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500">Your own images, used at your own discretion. Bleed is added unless the image already has it. Saved on this device only, so add Custom Images on the computer you export from.</p>
      </div>

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
          <p className="text-xs text-stone-400">{printings ? `${printings.length} printings` : 'Loading printings…'}{current && <> · current: <span className={customImageUrls.front ? '' : 'font-mono'}>{current}</span></>}</p>
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
        {customImageUrls.front && (
          <button
            type="button"
            aria-pressed={!picked}
            onClick={() => setPicked(null)}
            className={`flex flex-col gap-1 p-1 rounded-lg border-2 text-left ${picked ? 'border-dashed border-sky-800 hover:border-sky-600' : 'border-sky-500'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={customImageUrls.front} alt="Your Custom Image" className="w-full aspect-[63/88] rounded-md bg-stone-800 object-cover" />
            <span className="text-[11px] font-semibold text-sky-300 truncate">Custom Image</span>
          </button>
        )}
        {shown.map(p => {
          const isCurrent = !customImageUrls.front && p.scryfallId === card.scryfallId
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
        {!pickedPrinting && customNote ? (
          <>
            <PrimaryButton onClick={onClose} disabled={busy}>Done</PrimaryButton>
            <p className="text-center text-xs text-sky-300">{customNote}</p>
          </>
        ) : (
          <>
            <PrimaryButton onClick={save} disabled={!picked || busy}>
              {busy ? 'Saving…' : pickedPrinting ? `Use ${pickedPrinting.setCode.toUpperCase()} ${pickedPrinting.collectorNumber}${customImageUrls.front ? ' instead' : ''}` : 'Pick a printing'}
            </PrimaryButton>
            <p className="text-center text-xs text-stone-500">{saveNote}</p>
          </>
        )}
      </div>
    </LeagueModal>
  )
}
