import type { createSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export type AttendanceStatus = 'present' | 'absent' | 'late'

export interface RosterStudent {
  id: string
  first_name: string
  last_name: string
}

export interface RawAttendanceRecord {
  student_id: string
  status: AttendanceStatus
}

export interface StudentAttendanceSummary {
  studentId: string
  firstName: string
  lastName: string
  present: number
  late: number
  absent: number
  /** Total sessions this student was marked in (present + late + absent). */
  totalMarked: number
  /**
   * Attendance rate as a whole-number percentage, or null if the student has
   * no records in range. LATE COUNTS AS PRESENT — the numerator is
   * (present + late). Policy decision locked 2026-06-22.
   */
  attendanceRate: number | null
}

/**
 * Attendance rate as a whole-number percentage.
 * Late counts toward attendance: rate = (present + late) / total.
 * Returns null when there are no records (no basis to compute a rate).
 */
export function computeAttendanceRate(
  present: number,
  late: number,
  absent: number,
): number | null {
  const total = present + late + absent
  if (total === 0) return null
  return Math.round(((present + late) / total) * 100)
}

/**
 * Aggregates raw attendance records into a per-student summary, anchored on the
 * class roster so students with zero records still appear (e.g. a child who
 * joined the class part-way through the range). Records for students no longer
 * on the roster are ignored.
 */
export function aggregateAttendance(
  roster: RosterStudent[],
  records: RawAttendanceRecord[],
): StudentAttendanceSummary[] {
  const counts = new Map<string, { present: number; late: number; absent: number }>()
  for (const s of roster) counts.set(s.id, { present: 0, late: 0, absent: 0 })

  for (const r of records) {
    const entry = counts.get(r.student_id)
    if (entry) entry[r.status]++
  }

  return roster.map((s) => {
    const c = counts.get(s.id) ?? { present: 0, late: 0, absent: 0 }
    return {
      studentId: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      present: c.present,
      late: c.late,
      absent: c.absent,
      totalMarked: c.present + c.late + c.absent,
      attendanceRate: computeAttendanceRate(c.present, c.late, c.absent),
    }
  })
}

// ─── Date-range helpers ───────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Formats a Date to YYYY-MM-DD using local components (no timezone shift). */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday–Sunday range containing the reference date (ISO week). */
export function getWeekRange(ref: Date = new Date()): { from: string; to: string } {
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const offset = (monday.getDay() + 6) % 7 // 0 = Monday
  monday.setDate(monday.getDate() - offset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toDateString(monday), to: toDateString(sunday) }
}

/** First–last day of the month containing the reference date. */
export function getMonthRange(ref: Date = new Date()): { from: string; to: string } {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  return { from: toDateString(from), to: toDateString(to) }
}

/**
 * Resolves a {from, to} range from optional query params, defaulting to the
 * current month. Invalid or out-of-order values fall back to the month range.
 */
export function resolveDateRange(
  from: string | undefined,
  to: string | undefined,
  ref: Date = new Date(),
): { from: string; to: string } {
  const month = getMonthRange(ref)
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) return month
  if (from > to) return month
  return { from, to }
}

// ─── Parent-facing flags ──────────────────────────────────────────────────────

/** A day a student was not fully present (used for the parent attendance view). */
export interface AttendanceFlag {
  date: string
  status: 'late' | 'absent'
  note: string | null
}

/** Most-recent flags first (by `date`), capped at `limit`. Pure — unit-tested. */
export function latestFlags<T extends { date: string }>(flags: T[], limit: number): T[] {
  return [...flags].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export interface ClassAttendanceSummary {
  students: StudentAttendanceSummary[]
  /** Number of attendance sessions held for the class within the range. */
  totalSessions: number
}

/**
 * Fetches and aggregates a class's attendance for a date range.
 * Three reads: session ids in range → class roster → records for those sessions,
 * then aggregated in memory (trivial volume at primary-school scale).
 */
export async function getClassAttendanceSummary(
  adminClient: AdminClient,
  classId: string,
  from: string,
  to: string,
): Promise<ClassAttendanceSummary> {
  const { data: sessions } = await adminClient
    .from('attendance_sessions')
    .select('id')
    .eq('class_id', classId)
    .gte('session_date', from)
    .lte('session_date', to)

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id)

  const { data: roster } = await adminClient
    .from('students')
    .select('id, first_name, last_name')
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  const { data: records } =
    sessionIds.length > 0
      ? await adminClient
          .from('attendance_records')
          .select('student_id, status')
          .in('session_id', sessionIds)
      : { data: [] as RawAttendanceRecord[] }

  return {
    students: aggregateAttendance(
      (roster ?? []) as RosterStudent[],
      (records ?? []) as RawAttendanceRecord[],
    ),
    totalSessions: sessionIds.length,
  }
}

// ─── Phase 2: period rollups (weekly / monthly) ───────────────────────────────

export type Granularity = 'week' | 'month'

export interface DatedRecord {
  date: string // session_date, YYYY-MM-DD
  status: AttendanceStatus
}

export interface PeriodSummary {
  /** Sortable key: Monday's date for weeks (YYYY-MM-DD), YYYY-MM for months. */
  key: string
  /** Human label, e.g. "Week of 22 Jun" or "June 2026". */
  label: string
  present: number
  late: number
  absent: number
  /** Distinct attendance sessions held in the period. */
  sessionCount: number
  /** Class attendance rate for the period; late counts as present. Null if no records. */
  attendanceRate: number | null
}

/** Normalises an optional query value into a granularity (defaults to month). */
export function resolveGranularity(g: string | undefined): Granularity {
  return g === 'week' ? 'week' : 'month'
}

/** The period key a date falls into. Week keys are the Monday of that week. */
export function periodKey(dateStr: string, g: Granularity): string {
  if (g === 'month') return dateStr.slice(0, 7) // YYYY-MM
  const d = new Date(dateStr + 'T00:00:00')
  const offset = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - offset)
  return toDateString(d)
}

/** Display label for a period key. */
export function periodLabel(key: string, g: Granularity): string {
  if (g === 'month') {
    const year = Number(key.slice(0, 4))
    const month = Number(key.slice(5, 7))
    return new Date(year, month - 1, 1).toLocaleDateString('en-IE', {
      month: 'long',
      year: 'numeric',
    })
  }
  const monday = new Date(key + 'T00:00:00')
  return `Week of ${monday.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}`
}

/**
 * Groups dated attendance records into chronological period summaries.
 * Each period's rate is the class-wide (present + late) / total for that period.
 */
export function aggregateByPeriod(records: DatedRecord[], g: Granularity): PeriodSummary[] {
  const map = new Map<
    string,
    { present: number; late: number; absent: number; dates: Set<string> }
  >()

  for (const r of records) {
    const key = periodKey(r.date, g)
    let entry = map.get(key)
    if (!entry) {
      entry = { present: 0, late: 0, absent: 0, dates: new Set() }
      map.set(key, entry)
    }
    entry[r.status]++
    entry.dates.add(r.date)
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, e]) => ({
      key,
      label: periodLabel(key, g),
      present: e.present,
      late: e.late,
      absent: e.absent,
      sessionCount: e.dates.size,
      attendanceRate: computeAttendanceRate(e.present, e.late, e.absent),
    }))
}

/**
 * Fetches a class's attendance grouped into week or month periods over a range.
 * Joins records to their session date in memory (trivial volume at this scale).
 */
export async function getClassAttendanceTrend(
  adminClient: AdminClient,
  classId: string,
  from: string,
  to: string,
  g: Granularity,
): Promise<PeriodSummary[]> {
  const { data: sessions } = await adminClient
    .from('attendance_sessions')
    .select('id, session_date')
    .eq('class_id', classId)
    .gte('session_date', from)
    .lte('session_date', to)

  const sessionList = (sessions ?? []) as { id: string; session_date: string }[]
  if (sessionList.length === 0) return []

  const dateById = new Map(sessionList.map((s) => [s.id, s.session_date]))

  const { data: records } = await adminClient
    .from('attendance_records')
    .select('session_id, status')
    .in(
      'session_id',
      sessionList.map((s) => s.id),
    )

  const dated: DatedRecord[] = []
  for (const r of (records ?? []) as { session_id: string; status: AttendanceStatus }[]) {
    const date = dateById.get(r.session_id)
    if (date) dated.push({ date, status: r.status })
  }

  return aggregateByPeriod(dated, g)
}
