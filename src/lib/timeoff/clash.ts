// Time-off clash detection — pure helpers. Dates are inclusive `YYYY-MM-DD` strings
// (lexicographic order = chronological, so string comparison is safe).

export interface LeaveInterval {
  teacherId: string
  name: string
  start: string
  end: string
}

/** Two inclusive date ranges overlap. */
export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/** Of `others`, the leave (different staff) that overlaps `target`. */
export function overlappingLeave(target: LeaveInterval, others: LeaveInterval[]): LeaveInterval[] {
  return others.filter(
    (o) =>
      o.teacherId !== target.teacherId && datesOverlap(target.start, target.end, o.start, o.end),
  )
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export interface ClashDay {
  date: string
  names: string[] // distinct staff off that day (2+)
}

/**
 * Days in [fromISO, toISO] where 2+ distinct staff are on leave at once — a potential
 * staffing shortage. Capped at a sane number of iterations by the caller's range.
 */
export function clashDaysInRange(
  intervals: LeaveInterval[],
  fromISO: string,
  toISO: string,
): ClashDay[] {
  if (fromISO > toISO) return []
  const out: ClashDay[] = []
  for (let d = fromISO; d <= toISO; d = nextDay(d)) {
    const names = [
      ...new Set(intervals.filter((iv) => iv.start <= d && d <= iv.end).map((iv) => iv.name)),
    ]
    if (names.length >= 2) out.push({ date: d, names })
  }
  return out
}
