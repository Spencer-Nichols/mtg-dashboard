'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import OnboardingModal, { whatsNewStepFor, type Step } from '@/components/OnboardingModal'

export function WhatsNewForPage() {
  const pathname = usePathname()
  const [step, setStep] = useState<Step | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (cancelled || !profile) return
        // Not onboarded yet: the home page shows the full tour instead. No seen data: migration 0028 hasn't run.
        if (!profile.onboarded || !profile.whatsNewSeen) return
        const next = whatsNewStepFor(pathname, profile.onboardingVersion, profile.whatsNewSeen)
        if (next) setStep(next)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  if (!step) return null
  return <OnboardingModal whatsNewStep={step} onDismiss={() => setStep(null)} />
}
