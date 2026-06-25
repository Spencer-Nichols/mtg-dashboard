'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const CURRENT_VERSION = '0.23.3'

const SPARK_COLORS = ['#fbbf24', '#f59e0b', '#fcd34d', '#d97706', '#fde68a', '#fb923c']
const SPARK_COUNTS = { patch: 8, minor: 16, major: 26 }

function getBumpType(from: string, to: string): 'major' | 'minor' | 'patch' {
  const [fromMajor, fromMinor] = from.split('.').map(Number)
  const [toMajor, toMinor] = to.split('.').map(Number)
  if (toMajor > fromMajor) return 'major'
  if (toMinor > fromMinor) return 'minor'
  return 'patch'
}

function Sparks({ count }: { count: number }) {
  return (
    <span className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360
        const size = 2 + (i % 3)
        const duration = 0.5 + (i % 4) * 0.12
        const delay = (i % count) * (1.2 / count)
        return (
          <span key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, transform: `rotate(${angle}deg)` }}>
            <span style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              background: SPARK_COLORS[i % SPARK_COLORS.length],
              marginLeft: -size / 2,
              animation: `spark-fly ${duration}s ease-out ${delay}s infinite`,
              boxShadow: `0 0 3px ${SPARK_COLORS[i % SPARK_COLORS.length]}`,
            }} />
          </span>
        )
      })}
    </span>
  )
}

function SparkSegment({ children, active, count }: { children: string; active: boolean; count: number }) {
  return (
    <span className="relative inline-block">
      {active && <Sparks count={count} />}
      <span className={active ? 'text-amber-400' : 'text-stone-700'}>{children}</span>
    </span>
  )
}

export function VersionBadge() {
  const [type, setType] = useState<'major' | 'minor' | 'patch' | null>(null)
  const pathname = usePathname()
  const initialPathname = useRef(pathname)

  useEffect(() => {
    const last = localStorage.getItem('tapntrack_version')
    if (last !== CURRENT_VERSION) {
      setType(last ? getBumpType(last, CURRENT_VERSION) : 'patch')
      localStorage.setItem('tapntrack_version', CURRENT_VERSION)
    }
  }, [])

  useEffect(() => {
    if (pathname !== initialPathname.current) setType(null)
  }, [pathname])

  const [major, minor, patch] = CURRENT_VERSION.split('.')

  return (
    <span className="text-xs text-stone-500">
      TapNTrack <span className="text-stone-700">v</span>
      <SparkSegment active={type === 'major'} count={SPARK_COUNTS.major}>{major}</SparkSegment>
      <span className="text-stone-700">.</span>
      <SparkSegment active={type === 'minor'} count={SPARK_COUNTS.minor}>{minor}</SparkSegment>
      <span className="text-stone-700">.</span>
      <SparkSegment active={type === 'patch'} count={SPARK_COUNTS.patch}>{patch}</SparkSegment>
    </span>
  )
}
