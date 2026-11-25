'use client'

import { useState } from 'react'

export interface Step {
  title: string
  nav: string
  page: string
  // Bump to the next number when this step's NEW callout changes. Existing users see just this step
  // the next time they open `page`. Numbers continue on from ONBOARDING_VERSION in /api/profile.
  newIn: number
  description: string
  detail: string[]
  callout?: { label: string; title: string; body: string }
}

export const STEPS: Step[] = [
  {
    title: 'Your Binder',
    nav: 'Binder',
    page: '/binder',
    newIn: 8,
    description: 'Your personal card collection. Add cards, log what you paid, and track their value over time. Cards are sorted into Gainers, Losers, and Unchanged as prices shift. Tap any card to expand it and see its full price history chart.',
    detail: [
      'Search for a card to add it to your collection',
      'Bulk import from Moxfield, Arena, or a simple card list',
      'Set a purchase price to track your real gain or loss',
      'Tap a row to expand it and see the price history chart',
      'Export your collection as a Moxfield-compatible CSV',
    ],
    callout: {
      label: 'NEW',
      title: 'Gain vs. Value Chart',
      body: 'Toggle the binder chart between total value and unrealized gain/loss, so you can see how much your cards have actually moved in price, separate from just adding more to your collection.',
    },
  },
  {
    title: 'Brew & Search',
    nav: 'Search',
    page: '/search',
    newIn: 9,
    description: 'Look up any card on Scryfall. Pick a role, type to find a tag, and stack filters as chips in the search bar.',
    detail: [
      'Tap the search bar to pick a role (Ramp, Removal, Tutor…) or a price',
      'Start typing to find any of Scryfall\'s 5,000+ card tags, like "sac outlet" or "reanimate"',
      'Tap a tag chip to narrow it down, e.g. Removal → Creature',
      'Filter by color, type, CMC, oracle text, art style, and recent sets',
    ],
    callout: {
      label: 'NEW',
      title: 'Every Scryfall tag, built in',
      body: 'Search now includes all of Scryfall\'s 5,000+ card tags, from broad roles like Removal down to specifics like "sac outlet creature". Filters live as chips in the search bar, and "Owned only" shows just the cards in your binder.',
    },
  },
  {
    title: 'Wishlist',
    nav: 'Wishlist',
    page: '/wishlist',
    newIn: 8,
    description: "Cards you want but don't own yet. Add them and TapNTrack will track their price for you. When prices drop they'll appear in Drops.",
    detail: [
      'Add cards you\'re looking to acquire',
      'Drops section shows cards that have fallen in price',
      'Rising section shows cards climbing',
      'Move a card to your Binder once you\'ve picked it up',
    ],
    callout: {
      label: 'NEW',
      title: 'Price Alerts for Singles',
      body: 'Set a target price on any wishlisted card and get an email when it drops below it (or hits a new all-time low). Manage email alerts for both singles and sealed products from the Manage alerts dropdown.',
    },
  },
  {
    title: 'Deck Ideas',
    nav: 'Home',
    page: '/',
    newIn: 8,
    description: 'Thinking about building a deck for real? Paste a Moxfield list and TapNTrack prices every card from Scryfall, then keeps the total up to date. Your deck ideas live on the homepage, right under Binder Value.',
    detail: [
      'Paste a list from Moxfield (Export → Copy for Moxfield)',
      'Put your commander(s) in their own block at the top',
      'Compare the exact printings in the list against the cheapest printing of every card',
      'See which cards are already in your binder',
      'Tap a card to compare printings or add it to your wishlist',
    ],
    callout: {
      label: 'NEW',
      title: 'Deck Ideas',
      body: 'Save up to 3 deck ideas and watch their price over time. Send the expensive cards you don\'t own to your wishlist in one tap to get price alerts on them.',
    },
  },
]

export function whatsNewStepFor(pathname: string, onboardingVersion: number, seen: Record<string, number>): Step | null {
  const step = STEPS.find(s => s.page === pathname)
  if (!step?.callout) return null
  // Everything up to the user's onboarding version was already shown in the full tour
  const seenVersion = Math.max(seen[step.page] ?? 0, onboardingVersion)
  return step.newIn > seenVersion ? step : null
}

export default function OnboardingModal({ onDismiss, whatsNewStep }: { onDismiss: () => void; whatsNewStep?: Step }) {
  const steps = whatsNewStep ? [whatsNewStep] : STEPS
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  function handleDismiss() {
    if (whatsNewStep) {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: whatsNewStep.page, version: whatsNewStep.newIn }),
      })
    } else {
      const whatsNewSeen = Object.fromEntries(STEPS.map(s => [s.page, s.newIn]))
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsNewSeen }),
      })
    }
    onDismiss()
  }

  return (
    <div id="onboarding-overlay" className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div id="onboarding-modal" className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-800">
          <p className="text-xs text-amber-600 uppercase tracking-widest font-semibold mb-1">{whatsNewStep ? 'What’s new' : 'Welcome to TapNTrack'}</p>
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
          {steps.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-amber-500' : 'bg-stone-700 hover:bg-stone-500'}`}
                />
              ))}
            </div>
          )}

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
                {whatsNewStep ? 'Got it' : 'Get started'}
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
