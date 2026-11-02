'use client'

import { useEffect, useRef } from 'react'

const CLOSE_DISTANCE = 100

export function useScrollLock() {
  useEffect(() => {
    const body = document.body
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    return () => { body.style.overflow = previous }
  }, [])
}

// Swipe-down-to-close for bottom sheets on phones. Spread dragProps on the sheet's header/handle
// (not the scrolling body) so dragging never fights inner scroll.
export function useSheet(onClose: () => void, disabled = false) {
  useScrollLock()
  const panelRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const offset = useRef(0)

  function setOffset(px: number, animate: boolean) {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transition = animate ? 'transform 150ms ease-out' : 'none'
    panel.style.transform = px > 0 ? `translateY(${px}px)` : ''
  }

  const dragProps = {
    onTouchStart: (e: React.TouchEvent) => {
      const isPhone = window.matchMedia('(max-width: 639px)').matches
      if (disabled || !isPhone) return
      startY.current = e.touches[0].clientY
      offset.current = 0
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current == null) return
      offset.current = Math.max(0, e.touches[0].clientY - startY.current)
      setOffset(offset.current, false)
    },
    onTouchEnd: () => {
      if (startY.current == null) return
      startY.current = null
      if (offset.current > CLOSE_DISTANCE) onClose()
      else setOffset(0, true)
    },
  }

  return { panelRef, dragProps }
}

export function DragHandle() {
  return <div aria-hidden className="sm:hidden mx-auto mt-2 -mb-1 h-1.5 w-10 rounded-full bg-stone-600" />
}
