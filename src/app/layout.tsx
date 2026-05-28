import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TapNTrack',
  description: "Spencer's MTG collection tracker",
  icons: { icon: '/favicon.svg' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const service = createServiceClient()
      const { data } = await service.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
      isAdmin = !!data
    }
  } catch {}

  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        <nav className="sticky top-0 z-50 border-b-2 border-amber-900/50 bg-stone-900/80 backdrop-blur-sm">
          <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-8 overflow-x-auto">
            <Link href="/" className="text-amber-500 font-bold tracking-wide hover:text-amber-400 transition-colors shrink-0">
              TapNTrack
            </Link>
            <Link href="/search" className="text-xs sm:text-sm text-stone-400 hover:text-amber-400 transition-colors shrink-0 py-1">
              Search
            </Link>
            <Link href="/binder" className="text-xs sm:text-sm text-stone-400 hover:text-amber-400 transition-colors shrink-0 py-1">
              Binder
            </Link>
            <Link href="/wishlist" className="text-xs sm:text-sm text-stone-400 hover:text-amber-400 transition-colors shrink-0 py-1">
              Wishlist
            </Link>
            {isAdmin && (
              <Link href="/admin/requests" className="text-xs sm:text-sm text-stone-400 hover:text-amber-400 transition-colors shrink-0 py-1">
                Admin
              </Link>
            )}
            <form action={logout} className="ml-auto">
              <button type="submit" className="text-sm text-stone-500 hover:text-stone-300 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </nav>
        <main className="flex-1 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
