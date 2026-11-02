import Link from 'next/link'

export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      id="back-link"
      href={href}
      className="self-start py-2 -my-2 text-sm font-semibold text-amber-500 active:text-amber-300 sm:py-0 sm:my-0 sm:font-normal sm:text-stone-500 sm:hover:text-stone-300 transition-colors"
    >
      ← {label}
    </Link>
  )
}
