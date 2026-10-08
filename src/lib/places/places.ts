// Places & leavers — pure helpers (room vacancies + upcoming leavers).

/** Available places in a room = capacity − enrolled (never negative; null if no capacity set). */
export function availablePlaces(capacity: number | null, enrolled: number): number | null {
  if (capacity == null) return null
  return Math.max(0, capacity - Math.max(0, enrolled))
}

/** Whole days from `fromISO` to `toISO` (`YYYY-MM-DD`), UTC-parsed (NaN on bad input). */
export function daysUntil(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`)
  const b = Date.parse(`${toISO}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}

/**
 * Whether a leaving date is an "upcoming leaver" as of `todayISO`: on or after today and
 * within `horizonDays`. A past leaving date is not upcoming (they've already left).
 */
export function isUpcomingLeaver(
  leavingISO: string | null | undefined,
  todayISO: string,
  horizonDays = 90,
): boolean {
  if (!leavingISO) return false
  const d = daysUntil(todayISO, leavingISO)
  return !Number.isNaN(d) && d >= 0 && d <= horizonDays
}
