// Staff timesheets — pure helpers (status machine + planned-vs-actual variance).
// Reuses the rota time helpers (shiftMinutes/formatHours) for durations.

import { shiftMinutes } from './rota'

export const TIMESHEET_STATUSES = ['PENDING', 'APPROVED'] as const
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
}

export function isTimesheetStatus(v: string): v is TimesheetStatus {
  return (TIMESHEET_STATUSES as readonly string[]).includes(v)
}

/** Normalise a time value to `HH:MM` (DB stores `HH:MM:SS`, inputs send `HH:MM`). */
export function normalizeTime(t: string): string {
  return (t ?? '').slice(0, 5)
}

/**
 * Whether a timesheet's actual times are being changed (compared at minute precision).
 * Drives the "a reason is required to adjust the hours" rule.
 */
export function actualTimesChanged(
  oldStart: string,
  oldEnd: string,
  newStart: string,
  newEnd: string,
): boolean {
  return (
    normalizeTime(oldStart) !== normalizeTime(newStart) ||
    normalizeTime(oldEnd) !== normalizeTime(newEnd)
  )
}

/** Actual worked minutes for a timesheet entry (0 if times are invalid). */
export function actualMinutes(actualStart: string, actualEnd: string): number {
  return shiftMinutes(actualStart, actualEnd)
}

/**
 * Minutes the actual hours differ from the planned hours (positive = worked more than
 * rostered, negative = worked less). Both durations floored at 0 for invalid times.
 */
export function varianceMinutes(
  plannedStart: string,
  plannedEnd: string,
  actStart: string,
  actEnd: string,
): number {
  return shiftMinutes(actStart, actEnd) - shiftMinutes(plannedStart, plannedEnd)
}

/** A short signed label for a variance, e.g. 30 → "+0.5h", -60 → "-1h", 0 → "on plan". */
export function formatVariance(minutes: number): string {
  if (minutes === 0) return 'on plan'
  const sign = minutes > 0 ? '+' : '-'
  return `${sign}${parseFloat((Math.abs(minutes) / 60).toFixed(2))}h`
}

// ── Timesheet report (period summary) ──────────────────────────────────────────
export interface TimesheetReportRecord {
  teacherId: string
  name: string
  status: string
  actualStart: string
  actualEnd: string
}
export interface TimesheetReportLine {
  teacherId: string
  name: string
  approvedMinutes: number
  pendingMinutes: number
  totalMinutes: number
  entries: number
}

/** Per-staff hours over a set of timesheet records: approved vs pending vs total. */
export function summariseTimesheets(records: TimesheetReportRecord[]): TimesheetReportLine[] {
  const byTeacher = new Map<string, TimesheetReportLine>()
  for (const r of records) {
    const line = byTeacher.get(r.teacherId) ?? {
      teacherId: r.teacherId,
      name: r.name,
      approvedMinutes: 0,
      pendingMinutes: 0,
      totalMinutes: 0,
      entries: 0,
    }
    const mins = actualMinutes(r.actualStart, r.actualEnd)
    line.totalMinutes += mins
    if (r.status === 'APPROVED') line.approvedMinutes += mins
    else line.pendingMinutes += mins
    line.entries += 1
    byTeacher.set(r.teacherId, line)
  }
  return [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name))
}
