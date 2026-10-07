// Staff clock-in/out — pure helpers (state machine + worked minutes + report summary).

export interface StaffClockRow {
  clock_in_at: string | null
  clock_out_at: string | null
}

export type ClockState = 'not_in' | 'in' | 'out'

/** A staff member's state today from their clock row. */
export function clockState(row: StaffClockRow | undefined | null): ClockState {
  if (!row || !row.clock_in_at) return 'not_in'
  if (row.clock_out_at) return 'out'
  return 'in'
}

/** Minutes worked between clock-in and clock-out (0 unless both are set and ordered). */
export function workedMinutes(clockInISO: string | null, clockOutISO: string | null): number {
  if (!clockInISO || !clockOutISO) return 0
  const a = Date.parse(clockInISO)
  const b = Date.parse(clockOutISO)
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0
  return Math.round((b - a) / 60_000)
}

export interface StaffWorkRecord {
  teacherId: string
  name: string
  clockInAt: string | null
  clockOutAt: string | null
}
export interface StaffWorkLine {
  teacherId: string
  name: string
  minutes: number
  days: number // days with a completed (in + out) clock
}

/** Per-staff worked minutes + completed days over a set of clock records, sorted by name. */
export function summariseStaffWork(records: StaffWorkRecord[]): StaffWorkLine[] {
  const byTeacher = new Map<string, StaffWorkLine>()
  for (const r of records) {
    const line = byTeacher.get(r.teacherId) ?? {
      teacherId: r.teacherId,
      name: r.name,
      minutes: 0,
      days: 0,
    }
    const mins = workedMinutes(r.clockInAt, r.clockOutAt)
    line.minutes += mins
    if (mins > 0) line.days += 1
    byTeacher.set(r.teacherId, line)
  }
  return [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name))
}
