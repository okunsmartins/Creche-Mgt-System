/**
 * Attendance derived from the daily check-in board — pure helpers.
 *
 * The crèche's real attendance signal is `daily_check_ins`: a child is **present** on a day
 * when they have an arrival time (and weren't marked absent); otherwise, on a day the crèche
 * was open, they are **absent / no-show**. "Operating days" = the distinct dates in the range
 * on which at least one child was present (so weekends/closures don't count against anyone).
 */

export interface CheckinLite {
  student_id: string
  date: string
  checked_in_at: string | null
  status: string // 'present' | 'absent' | 'expected'
}

/** Present = has an arrival time and not explicitly marked absent. */
export function isPresent(
  row: Pick<CheckinLite, 'checked_in_at' | 'status'> | undefined | null,
): boolean {
  return Boolean(row && row.checked_in_at && row.status !== 'absent')
}

/** Distinct dates (sorted) the crèche was open = any child present that day. */
export function operatingDays(rows: CheckinLite[]): string[] {
  const s = new Set<string>()
  for (const r of rows) if (isPresent(r)) s.add(r.date)
  return [...s].sort()
}

export interface ChildRangeSummary {
  studentId: string
  present: number
  absent: number
  operating: number
  /** present / operating as a %, or null when the crèche had no operating days in range. */
  rate: number | null
}

/**
 * Per-child present/absent counts over the operating days in a range. A child is absent on an
 * operating day they weren't present. `operating` is the same for every child (open days).
 */
export function summariseByChild(
  studentIds: string[],
  rows: CheckinLite[],
  opDays: string[],
): Map<string, ChildRangeSummary> {
  const presentDays = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!isPresent(r)) continue
    const set = presentDays.get(r.student_id) ?? new Set<string>()
    set.add(r.date)
    presentDays.set(r.student_id, set)
  }
  const operating = opDays.length
  const out = new Map<string, ChildRangeSummary>()
  for (const id of studentIds) {
    const present = presentDays.get(id)?.size ?? 0
    out.set(id, {
      studentId: id,
      present,
      absent: Math.max(0, operating - present),
      operating,
      rate: operating === 0 ? null : Math.round((present / operating) * 100),
    })
  }
  return out
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

/** Join rows into a CSV string (every cell quoted/escaped, CRLF line endings). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function attendanceReportFilename(from: string, to: string): string {
  return from === to ? `attendance-${from}.csv` : `attendance-${from}-to-${to}.csv`
}

export type AttendanceView = 'day' | 'week' | 'month'
export const ATTENDANCE_VIEWS: readonly AttendanceView[] = ['day', 'week', 'month']
export function isAttendanceView(v: string): v is AttendanceView {
  return (ATTENDANCE_VIEWS as readonly string[]).includes(v)
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** The [from, to] date range for a view anchored on `anchorISO` (weeks run Mon–Sun). */
export function attendanceRange(
  view: AttendanceView,
  anchorISO: string,
): { from: string; to: string } {
  const d = new Date(`${anchorISO}T00:00:00Z`)
  if (view === 'day') return { from: anchorISO, to: anchorISO }
  if (view === 'week') {
    const dow = (d.getUTCDay() + 6) % 7 // 0 = Monday
    const mon = new Date(d)
    mon.setUTCDate(d.getUTCDate() - dow)
    const sun = new Date(mon)
    sun.setUTCDate(mon.getUTCDate() + 6)
    return { from: iso(mon), to: iso(sun) }
  }
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() // 0-based
  const from = new Date(Date.UTC(y, m, 1))
  const to = new Date(Date.UTC(y, m + 1, 0)) // day 0 of next month = last day of this
  return { from: iso(from), to: iso(to) }
}

/** Move the anchor one period earlier (-1) or later (+1) for the given view. */
export function shiftAnchor(view: AttendanceView, anchorISO: string, dir: -1 | 1): string {
  const d = new Date(`${anchorISO}T00:00:00Z`)
  if (view === 'day') d.setUTCDate(d.getUTCDate() + dir)
  else if (view === 'week') d.setUTCDate(d.getUTCDate() + 7 * dir)
  else {
    // Normalise to the 1st first so month-ends (e.g. the 31st) don't roll over a month.
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + dir)
  }
  return iso(d)
}
