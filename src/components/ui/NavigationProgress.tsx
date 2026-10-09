'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type BarState = 'idle' | 'loading' | 'completing' | 'done'

export function NavigationProgress() {
  const pathname = usePathname()
  const [barState, setBarState] = useState<BarState>('idle')
  const prevPath = useRef(pathname)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  // Complete the bar when the pathname changes after a navigation started
  useEffect(() => {
    if (barState !== 'loading') return
    if (pathname === prevPath.current) return
    prevPath.current = pathname
    setBarState('completing')
    clearTimer()
    // Give the bar 220ms to slide to 100%, then fade it out
    timer.current = setTimeout(() => {
      setBarState('done')
      timer.current = setTimeout(() => setBarState('idle'), 350)
    }, 220)
  }, [pathname, barState])

  // Intercept same-origin link clicks to start the bar immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a[href]')
      if (!anchor) return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const href = anchor.getAttribute('href') ?? ''
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      )
        return
      prevPath.current = pathname
      clearTimer()
      setBarState('loading')
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  // Clean up timers on unmount
  useEffect(() => () => clearTimer(), [])

  if (barState === 'idle') return null

  let barStyle: React.CSSProperties
  if (barState === 'loading') {
    barStyle = { animation: 'nav-progress 3s cubic-bezier(0.08, 0.82, 0.17, 1) forwards' }
  } else if (barState === 'completing') {
    barStyle = { width: '100%', transition: 'width 220ms ease' }
  } else {
    barStyle = { width: '100%', opacity: 0, transition: 'opacity 350ms ease' }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden" aria-hidden="true">
      <div className="h-full bg-primary shadow-[0_0_8px_0px_#0f6b64]" style={barStyle} />
    </div>
  )
}
