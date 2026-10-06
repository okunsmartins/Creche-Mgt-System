// Funding & Hive Centre — pure helpers for the time-based proactive scans (§9).
// Two daily scans complement the event-driven hooks and the weekly NCS cron:
//   * award/CHICK expiry — warn before an NCS award lapses (and once it has);
//   * readiness drift — surface a Programme Readiness item that's still missing or
//     needs review as its due date approaches or passes.
// Pure (ISO-date string arithmetic, lexicographic compare); the DB-backed runners in
// service.ts feed these and raise deduped hive_action_items.

import { addDays } from './week'

/** How far ahead to warn that an NCS award is about to expire. */
export const AWARD_EXPIRY_WARN_DAYS = 30
/** How far ahead to flag a still-incomplete readiness item by its due date. */
export const READINESS_DRIFT_WARN_DAYS = 14

export type AwardExpiryStatus = 'NONE' | 'APPROACHING' | 'EXPIRED'

/**
 * Classify an award's expiry relative to today: already lapsed (EXPIRED), within the
 * warning window (APPROACHING), or far enough out to ignore (NONE). All inputs are ISO
 * dates (YYYY-MM-DD), which compare correctly as strings.
 */
export function awardExpiryStatus(
  expiryISO: string,
  todayISO: string,
  warnWithinDays: number = AWARD_EXPIRY_WARN_DAYS,
): AwardExpiryStatus {
  if (expiryISO < todayISO) return 'EXPIRED'
  const horizon = addDays(todayISO, Math.max(0, warnWithinDays))
  if (expiryISO <= horizon) return 'APPROACHING'
  return 'NONE'
}

/**
 * Whether a Programme Readiness item has drifted: it still needs work (MISSING or
 * REVIEW_REQUIRED) AND it has a due date at or inside the warning window (which
 * includes overdue). Items with no due date aren't time-flagged here.
 */
export function readinessDriftDue(
  status: string,
  dueDateISO: string | null,
  todayISO: string,
  warnWithinDays: number = READINESS_DRIFT_WARN_DAYS,
): boolean {
  if (status !== 'MISSING' && status !== 'REVIEW_REQUIRED') return false
  if (!dueDateISO) return false
  return dueDateISO <= addDays(todayISO, Math.max(0, warnWithinDays))
}
