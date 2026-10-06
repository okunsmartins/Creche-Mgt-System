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
