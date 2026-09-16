import type { PermissionSlipAudience } from '@/types/database'

export const SLIP_TITLE_MAX = 140
export const SLIP_DESC_MAX = 2000
export const SLIP_NOTE_MAX = 500

export function isSlipAudience(v: string): v is PermissionSlipAudience {
  return v === 'class' || v === 'school'
}

/**
 * The local YYYY-MM-DD date `daysAhead` days from `now` — the due date a
 * reminder run targets (e.g. daysAhead=1 → tomorrow). Pure — unit-tested.
 */
export function dueReminderDate(now: Date, daysAhead: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface SlipResponseTally {
  total: number
  granted: number
  declined: number
  pending: number
}

/**
 * Tally consent responses against the number of target students. Pending is the
 * students who have not responded yet (never negative). Pure — unit-tested.
 */
export function tallyResponses(
  totalStudents: number,
  responses: readonly { consent: boolean }[],
): SlipResponseTally {
  let granted = 0
  let declined = 0
  for (const r of responses) {
    if (r.consent) granted += 1
    else declined += 1
  }
  const pending = Math.max(0, totalStudents - granted - declined)
  return { total: totalStudents, granted, declined, pending }
}
