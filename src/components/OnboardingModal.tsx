'use client'

import { useState } from 'react'

interface Step {
  title: string
  nav: string
  description: string
  detail: string[]
  callout?: { label: string; title: string; body: string }
}

const STEPS: Step[] = [
  {
    title: 'Your Binder',
    nav: 'Binder',
    description: 'Your personal card collection. Add cards, log what you paid, and track their value over time. Cards are sorted into Gainers, Losers, and Unchanged as prices shift. Tap any card to expand it and see its full price history chart.',
    detail: [
      'Search for a card to add it to your collection',
      'Bulk import from Moxfield, Arena, or a simple card list',
      'Set a purchase price to track your real gain or loss',
      'Tap a row to expand it and see the price history chart',
      'Export your collection as a Moxfield-compatible CSV',
    ],
  },
  {
    title: 'Brew & Search',
    nav: 'Search',
    description: 'Look up any card on Scryfall instantly. The Brew tab lets you build advanced searches using keyword pills and filters.',
    detail: [
      'Use the Brew tab for advanced Scryfall syntax',
      'Filter by color, type, CMC, price, and keywords',
      'Results pull live data directly from Scryfall',
      'Search by card name to see prices and printings',
    ],
  },
  {
    title: 'Wishlist',
    nav: 'Wishlist',
    description: "Cards you want but don't own yet. Add them and TapNTrack will track their price for you. When prices drop they'll appear in Drops.",
    detail: [
      'Add cards you\'re looking to acquire',
      'Drops section shows cards that have fallen in price',
      'Rising section shows cards climbing',
      'Move a card to your Binder once you\'ve picked it up',
    ],
    callout: {
      label: 'NEW',
      title: 'Sealed Products',
      body: 'Track booster boxes, collector boxes, bundles, and more! Prices are pulled from both TCGPlayer and Manapool, whichever is lowest. Set a target price or get alerted when prices hit an all-time low.',
    },
  },
]

export default function OnboardingModal({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function handleDismiss() {
    fetch('/api/profile', { method: 'POST' })
    onDismiss()
  }

  return (
    <div id="onboarding-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div id="onboarding-modal" className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-800">
          <p className="text-xs text-amber-600 uppercase tracking-widest font-semibold mb-1">Welcome to TapNTrack</p>
          <h2 className="text-lg font-bold text-stone-100">{current.title}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-5 flex flex-col gap-4 flex-1">
          <p className="text-sm text-stone-400 leading-relaxed">{current.description}</p>
          <ul className="flex flex-col gap-2">
            {current.detail.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-stone-300">
                <span className="text-amber-600 mt-0.5 shrink-0">›</span>
                {d}
              </li>
            ))}
          </ul>
          {current.callout && (
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-600 text-stone-950">{current.callout.label}</span>
                <p className="text-sm font-semibold text-amber-300">{current.callout.title}</p>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">{current.callout.body}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-4">
          {/* Step dots */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-amber-500' : 'bg-stone-700 hover:bg-stone-500'}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 border border-stone-700 hover:border-stone-500 text-stone-400 hover:text-stone-200 font-semibold rounded-lg px-4 py-2.5 transition-colors text-sm"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleDismiss}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors text-sm"
              >
                Get started
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-lg px-4 py-2.5 transition-colors text-sm"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
