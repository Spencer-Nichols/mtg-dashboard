'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

interface SiteNavProps {
  logoClassName: string
  isAdmin: boolean
  leagueOffers: number | null
}

function OfferBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} trade offer${count === 1 ? '' : 's'} waiting`}
      role="status"
      className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"
    />
  )
}

export default function SiteNav({ logoClassName, isAdmin, leagueOffers }: SiteNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(pathname)
  if (open && openedAt !== pathname) setOpen(false)

  const links = [
    { href: '/search', label: 'Search' },
    { href: '/binder', label: 'Binder' },
    { href: '/wishlist', label: 'Wishlist' },
    ...(leagueOffers != null ? [{ href: '/league', label: 'League', badge: leagueOffers }] : []),
    ...(isAdmin ? [{ href: '/admin/requests', label: 'Admin' }] : []),
  ]
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const menuBadge = leagueOffers ?? 0

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-amber-900/50 bg-stone-900/80 backdrop-blur-sm">
      <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-8">
        <Link href="/" className={`${logoClassName} text-amber-500 font-bold tracking-wide hover:text-amber-400 transition-colors shrink-0`}>
          TapNTrack
        </Link>

        <div className="hidden sm:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`inline-flex items-center gap-1.5 text-sm transition-colors py-1 ${active(l.href) ? 'text-amber-400' : 'text-stone-400 hover:text-amber-400'}`}
            >
              {l.label}
              {'badge' in l && <OfferBadge count={l.badge ?? 0} />}
            </Link>
          ))}
        </div>

        <form action={logout} className="hidden sm:block ml-auto">
          <button type="submit" className="text-sm text-stone-500 hover:text-stone-300 transition-colors cursor-pointer">
            Sign out
          </button>
        </form>

        <button
          onClick={() => { setOpen(!open); setOpenedAt(pathname) }}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="sm:hidden ml-auto relative w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-stone-300 hover:text-amber-400 cursor-pointer"
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {!open && menuBadge > 0 && <span aria-hidden className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-600" />}
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t border-stone-800 px-4 pb-3 flex flex-col">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 py-3 text-base border-b border-stone-800/70 ${active(l.href) ? 'text-amber-400' : 'text-stone-200'}`}
            >
              {l.label}
              {'badge' in l && <OfferBadge count={l.badge ?? 0} />}
            </Link>
          ))}
          <form action={logout}>
            <button type="submit" className="w-full text-left py-3 text-base text-stone-400 cursor-pointer">Sign out</button>
          </form>
        </div>
      )}
    </nav>
  )
}
