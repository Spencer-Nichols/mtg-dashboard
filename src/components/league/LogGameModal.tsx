'use client'

import { useState } from 'react'
import { placesFromOrder } from '@/lib/league/rules'
import LeagueModal, { Chip, ModalError, PrimaryButton, useAction } from './LeagueModal'

interface LogGameModalProps {
  gameNumber: number
  members: { id: string; name: string }[]
  finishPoints: number[]
  onClose: () => void
  onSaved: () => void
}

const PLACE_LABEL = ['1st', '2nd', '3rd', '4th']

export default function LogGameModal({ gameNumber, members, finishPoints, onClose, onSaved }: LogGameModalProps) {
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [order, setOrder] = useState(members.map(m => m.id))
  const [tied, setTied] = useState<boolean[]>([])
  const [killers, setKillers] = useState<Record<string, string>>({})
  const { busy, error, run } = useAction(onSaved)

  const name = (id: string) => members.find(m => m.id === id)?.name ?? id
  const places = placesFromOrder(order, tied)

  function toggleMissed(id: string) {
    const next = new Set(missed)
    if (next.has(id)) {
      next.delete(id)
      setOrder([id, ...order])
    } else {
      next.add(id)
      setOrder(order.filter(x => x !== id))
    }
    setMissed(next)
    setTied([])
    setKillers({})
  }

  function move(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
    setTied([])
    setKillers({})
  }

  function toggleTie(i: number) {
    const next = [...tied]
    next[i] = !next[i]
    setTied(next)
  }

  const firstOutIds = order.filter(id => places.get(id) === Math.max(...order.map(x => places.get(x)!)))
  const bloodBy = firstOutIds.map(id => killers[id]).find(Boolean)
  const ready = order.length >= 2 && order.slice(0, -1).every(id => killers[id] && places.get(killers[id])! < places.get(id)!)

  return (
    <LeagueModal title={`Log Game ${gameNumber}`} busy={busy} onClose={onClose}>
      <ModalError error={error} />

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-300">
        <legend className="text-xs text-stone-500 uppercase tracking-wider mb-2">Didn&apos;t play</legend>
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={missed.has(m.id)} onChange={() => toggleMissed(m.id)} className="accent-amber-600" />
            {m.name}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-500 uppercase tracking-wider">Elimination order · first out at the top</p>
        {order.map((id, i) => {
          const place = places.get(id)!
          const isWinner = i === order.length - 1
          const points = finishPoints[place - 1] ?? 0
          const blood = id === bloodBy ? 1 : 0
          const outlasted = order.filter(x => places.get(x)! < place)
          return (
            <div key={id} className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="w-9 text-sm font-bold text-amber-200 font-mono">{PLACE_LABEL[place - 1]}</span>
                <span className="flex-1 text-sm font-semibold text-stone-100">{name(id)}</span>
                <span className="text-xs font-mono text-stone-400">{blood ? `${points} + 1 pts` : `${points} pts`}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${name(id)} up`} className="w-10 h-10 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={isWinner} aria-label={`Move ${name(id)} down`} className="w-10 h-10 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 disabled:opacity-30">↓</button>
              </div>
              {!isWinner && (
                <div className="flex flex-wrap items-center gap-2 sm:pl-12">
                  <span className="text-xs text-stone-500">Knocked out by</span>
                  {outlasted.map(k => (
                    <Chip key={k} active={killers[id] === k} onClick={() => setKillers({ ...killers, [id]: k })}>{name(k)}</Chip>
                  ))}
                </div>
              )}
              {i > 0 && !isWinner && (
                <label className="flex items-center gap-2 sm:pl-12 text-xs text-stone-400 cursor-pointer">
                  <input type="checkbox" checked={!!tied[i]} onChange={() => toggleTie(i)} className="accent-amber-600" />
                  Out at the same time as {name(order[i - 1])} (both take the higher place)
                </label>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-xs text-stone-400 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 flex flex-col gap-1">
        <span>First Blood: <span className="text-amber-200">{bloodBy ? `${name(bloodBy)} (+1)` : 'pick who knocked out the first player'}</span></span>
        <span>Bounty points are added automatically when they apply.</span>
        {missed.size > 0 && <span>Missed players get 1 point and no weekly pack.</span>}
      </div>

      <PrimaryButton
        onClick={() => run({ action: 'logGame', order, tiedWithPrevious: tied, eliminatedBy: killers, missed: [...missed] })}
        disabled={busy || !ready}
      >
        {busy ? 'Saving…' : 'Save game'}
      </PrimaryButton>
    </LeagueModal>
  )
}
