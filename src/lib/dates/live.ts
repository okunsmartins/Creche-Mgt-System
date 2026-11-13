// Formatting for "live" dates in the marketing previews: always today's date in
// Irish time, so the sample screens never look out of date.

const TZ = 'Europe/Dublin'

function parts(d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-IE', { ...opts, timeZone: TZ })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
}

/** e.g. "Fri 13 Nov". */
export function shortDayDate(d: Date): string {
  const p = parts(d, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${p.weekday} ${p.day} ${p.month}`
}

/** e.g. "21 Nov". */
export function dayMonth(d: Date): string {
  const p = parts(d, { day: 'numeric', month: 'short' })
  return `${p.day} ${p.month}`
}

/** e.g. "November". */
export function monthName(d: Date): string {
  return parts(d, { month: 'long' }).month ?? ''
}

/** e.g. "2026". */
export function yearOf(d: Date): string {
  return parts(d, { year: 'numeric' }).year ?? ''
}

/** "Good morning" before 12:00, "Good afternoon" before 18:00, else "Good evening" (Irish time). */
export function greeting(d: Date): string {
  const hour = Number(parts(d, { hour: 'numeric', hourCycle: 'h23' }).hour)
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** The date `days` from `d`. */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}
