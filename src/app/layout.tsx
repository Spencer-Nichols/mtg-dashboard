import type { Metadata } from 'next'
import { Geist, Cinzel, Lora } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { VersionBadge } from '@/components/VersionBadge'
import SiteNav from '@/components/SiteNav'
import { leagueNavInfo } from '@/lib/league/store'
import { hasProxyAccess } from '@/lib/proxy-access'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })
const cinzel = Cinzel({ subsets: ['latin'], weight: ['700'], variable: '--font-cinzel' })
const serifBody = Lora({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-serif-body' })

export const metadata: Metadata = {
  metadataBase: new URL('https://tapntrack.app'),
  title: 'TapNTrack',
  description: 'Track your MTG collection, monitor card prices, and catch sealed product deals.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'TapNTrack',
    description: 'Track your MTG collection, monitor card prices, and catch sealed product deals.',
    url: 'https://tapntrack.app',
    siteName: 'TapNTrack',
    images: [{ url: '/favicon.svg', width: 512, height: 512, alt: 'TapNTrack' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TapNTrack',
    description: 'Track your MTG collection, monitor card prices, and catch sealed product deals.',
    images: ['/favicon.svg'],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false
  let canUseProxies = false
  let league: Awaited<ReturnType<typeof leagueNavInfo>> = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const service = createServiceClient()
      const { data } = await service.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
      isAdmin = !!data
      league = await leagueNavInfo(user).catch(() => null)
      canUseProxies = await hasProxyAccess(user.id).catch(() => false)
    }
  } catch {}

  return (
    <html lang="en" className={`${geist.className} ${cinzel.variable} ${serifBody.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        <SiteNav logoClassName={cinzel.className} isAdmin={isAdmin} canUseProxies={canUseProxies} leagueOffers={league ? league.pendingOffers : null} />
        <main className="flex-1 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t-2 border-amber-900/50 bg-stone-900/80 mt-auto">
          <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <VersionBadge />
            <a
              href="https://ko-fi.com/F1F521A8EM"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-500 hover:text-amber-300 transition-colors"
            >
              ☕ Buy me a coffee
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
