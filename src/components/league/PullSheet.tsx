'use client'

import Link from 'next/link'
import type { CardView } from '@/lib/league/views'
import LeagueModal, { PrimaryButton, RARITY_COLOR } from './LeagueModal'

export interface PullDetail extends CardView {
  pulledBy: string
  ownerId: string
  ownerName: string
  interested: boolean
  history: number[]
}

interface PullSheetProps {
  pull: PullDetail
  isMine: boolean
  busy: boolean
  onToggleInterest: () => void
  onClose: () => void
}

export function percentChange(history: number[]) {
  if (history.length < 2 || history[0] === 0) return null
  return ((history[history.length - 1] - history[0]) / history[0]) * 100
}

export function Sparkline({ values, className = 'w-full h-6' }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / span) * 100}`).join(' ')
  const rising = values[values.length - 1] >= values[0]
  return (
    <svg viewBox="0 -4 100 108" preserveAspectRatio="none" aria-hidden className={className}>
      <polyline points={points} fill="none" stroke={rising ? '#4ade80' : '#f87171'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export default function PullSheet({ pull, isMine, busy, onToggleInterest, onClose }: PullSheetProps) {
  const change = percentChange(pull.history)
  const low = pull.history.length ? Math.min(...pull.history) : null
  const high = pull.history.length ? Math.max(...pull.history) : null

  return (
    <LeagueModal title={pull.name} size="lg" busy={busy} onClose={onClose}>
      <div id="league-pull-details" className="flex flex-col sm:flex-row gap-4">
        <div className="w-48 sm:w-64 mx-auto sm:mx-0 aspect-[5/7] bg-stone-800 rounded-xl overflow-hidden shrink-0">
          {pull.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pull.imageUrl} alt={pull.name} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-amber-200">{pull.price != null ? `$${pull.price.toFixed(2)}` : '—'}</span>
            {change != null && (
              <span className={`text-sm font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
            )}
          </div>

          <div id="league-pull-chart" className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-col gap-1.5">
            {pull.history.length >= 2 ? (
              <>
                <Sparkline values={pull.history} className="w-full h-28" />
                <p className="flex justify-between text-[11px] font-mono text-stone-400">
                  <span>Low ${low!.toFixed(2)}</span>
                  <span>High ${high!.toFixed(2)}</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-stone-400">Price tracking just started. The chart fills in after about a day of price checks.</p>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-stone-500">Rarity</dt>
            <dd className={`capitalize ${RARITY_COLOR[pull.rarity] ?? 'text-stone-200'}`}>{pull.rarity}</dd>
            {pull.printing && (
              <>
                <dt className="text-stone-500">Printing</dt>
                <dd className="text-stone-200">{pull.printing}</dd>
              </>
            )}
            <dt className="text-stone-500">Pulled by</dt>
            <dd className="text-stone-200">{pull.pulledBy}</dd>
            <dt className="text-stone-500">Owner</dt>
            <dd className="text-stone-200">{pull.ownerName}</dd>
          </dl>
        </div>
      </div>

      {!isMine && (
        <PrimaryButton onClick={onToggleInterest} disabled={busy}>
          {busy ? 'Saving…' : pull.interested ? '★ Interested · tap to undo' : `I'm interested in this`}
        </PrimaryButton>
      )}
      <Link
        href={`/league/players/${pull.ownerId}?tab=${pull.zone}`}
        className="mb-[env(safe-area-inset-bottom)] w-full min-h-11 inline-flex items-center justify-center rounded-xl text-sm font-semibold border border-stone-700 text-stone-200 hover:border-stone-500 hover:text-stone-100 transition-colors"
      >
        View {isMine ? 'your' : `${pull.ownerName}'s`} deck
      </Link>
    </LeagueModal>
  )
}
