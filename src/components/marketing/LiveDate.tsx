'use client'

import { useEffect, useState } from 'react'
import { addDays, dayMonth, greeting, monthName, shortDayDate, yearOf } from '@/lib/dates/live'

/**
 * The visitor's "now", refreshed after mount and every minute. The server renders its
 * own date first (the page may be cached), then the browser swaps in the real one.
 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

const FORMATS = {
  /** "Fri 13 Nov" */
  today: (d: Date) => shortDayDate(d),
  /** "Good morning" / "Good afternoon" / "Good evening" */
  greeting: (d: Date) => greeting(d),
  /** "November" */
  month: (d: Date) => monthName(d),
  /** "2026" */
  year: (d: Date) => yearOf(d),
} as const

/** Always-current date text for the sample product screens. */
export function LiveDate({ format }: { format: keyof typeof FORMATS }) {
  const now = useNow()
  return <span suppressHydrationWarning>{FORMATS[format](now)}</span>
}

/** "21 Nov" — a date `days` from today. */
export function LiveDateIn({ days }: { days: number }) {
  const now = useNow()
  return <span suppressHydrationWarning>{dayMonth(addDays(now, days))}</span>
}
