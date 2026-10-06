// Staff rota — pure helpers (dates, shift durations, overlaps). No DB, no timezone:
// shift dates are ISO date strings and times are wall-clock "HH:MM"/"HH:MM:SS".

/** Format a Date as an ISO date (YYYY-MM-DD) in UTC. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/** Add `n` days to an ISO date, returning an ISO date. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

/** The Monday (ISO date) of the week containing `date`. */
export function mondayOf(date: Date | string): string {
  const d =
    typeof date === 'string'
      ? parseISO(date)
      : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() // 0=Sun … 6=Sat
  const deltaToMonday = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + deltaToMonday)
  return toISODate(d)
}

/** The seven ISO dates (Mon…Sun) of the rota week starting `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Minutes since midnight for a wall-clock time "HH:MM" or "HH:MM:SS". NaN if malformed. */
export function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/** Duration of a shift in minutes (0 if malformed or non-positive). */
export function shiftMinutes(startTime: string, endTime: string): number {
  const a = timeToMinutes(startTime)
  const b = timeToMinutes(endTime)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, b - a)
}

/** Hours label for a minute total, trailing zeros dropped, e.g. 450 → "7.5h", 480 → "8h". */
export function formatHours(minutes: number): string {
  return `${parseFloat((minutes / 60).toFixed(2))}h`
}

/** Whether two same-day time ranges overlap (touching edges don't count). */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = timeToMinutes(aStart)
  const a2 = timeToMinutes(aEnd)
  const b1 = timeToMinutes(bStart)
  const b2 = timeToMinutes(bEnd)
  if ([a1, a2, b1, b2].some(Number.isNaN)) return false
  return a1 < b2 && b1 < a2
}

/** Validate a new shift's times; returns an error message or null. */
export function validateShiftTimes(startTime: string, endTime: string): string | null {
  const a = timeToMinutes(startTime)
  const b = timeToMinutes(endTime)
  if (Number.isNaN(a) || Number.isNaN(b)) return 'Enter valid start and end times.'
  if (b <= a) return 'End time must be after the start time.'
  return null
}
