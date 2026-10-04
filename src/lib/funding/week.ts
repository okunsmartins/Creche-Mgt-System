// NCS reporting-week helpers (pure, UTC date arithmetic to avoid tz drift).
// The NCS reporting week runs Monday–Sunday; the weekly return becomes available
// at the end of the week (Sunday) and is due the following Tuesday.

/** Format a Date as an ISO date (YYYY-MM-DD) in UTC. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/** Add `n` days to an ISO date, returning an ISO date. */
export function addDays(iso: string, n: number): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

/** The Monday (ISO date) of the reporting week containing `date`. */
export function reportingWeekStart(date: Date | string): string {
  const d =
    typeof date === 'string'
      ? parse(date)
      : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() // 0=Sun … 6=Sat
  const deltaToMonday = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + deltaToMonday)
  return toISODate(d)
}

/** The Monday of the week before `weekStart`. */
export function previousWeekStart(weekStart: string): string {
  return addDays(weekStart, -7)
}

/** The seven ISO dates (Mon…Sun) of a reporting week. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** Sunday (inclusive end) of a reporting week. */
export function weekEnd(weekStart: string): string {
  return addDays(weekStart, 6)
}

/**
 * The most recent FULLY-COMPLETED reporting week as of `now` — i.e. the Monday of
 * the week before the current one. This is the week a provider would report on.
 */
export function latestCompletedWeekStart(now: Date = new Date()): string {
  return previousWeekStart(reportingWeekStart(now))
}
