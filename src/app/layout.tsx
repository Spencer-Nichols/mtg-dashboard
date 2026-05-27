import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MTG Dashboard',
  description: "Spencer's MTG collection tracker",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        <nav className="sticky top-0 z-50 border-b-2 border-amber-900/50 bg-stone-900/80 backdrop-blur-sm">
          <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4 sm:gap-8">
            <Link href="/" className="text-amber-500 font-bold tracking-wide hover:text-amber-400 transition-colors shrink-0">
              <span className="sm:hidden">MTG</span>
              <span className="hidden sm:inline">MTG Dashboard</span>
            </Link>
            <Link href="/search" className="text-sm text-stone-400 hover:text-amber-400 transition-colors">
              Search
            </Link>
            <Link href="/binder" className="text-sm text-stone-400 hover:text-amber-400 transition-colors">
              Binder
            </Link>
            <Link href="/wishlist" className="text-sm text-stone-400 hover:text-amber-400 transition-colors">
              Wishlist
            </Link>
          </div>
        </nav>
        <main className="flex-1 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
