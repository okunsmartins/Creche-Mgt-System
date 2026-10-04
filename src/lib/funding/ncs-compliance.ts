// Funding & Hive Centre — pure NCS weekly-compliance engine (Phase 1).
//
// The heart of the proactive compliance layer: given a week's attendance versus the
// child's claimed NCS hours, plus the running sequence state, it derives whether the
// week was under-attended / a full-week absence, advances the consecutive counters,
// and emits the threshold event (4/8/12) AND a pre-threshold risk state (weeks 6/7)
// before the 8-week action. Pure — no DB/time — so it is fully unit-testable and its
// results are reproducible from a rules version. The DB-backed NcsComplianceService
// feeds it raw attendance and persists immutable snapshots.

import type { NcsRules } from './rules'

export type ThresholdEvent = 'NONE' | 'ABSENCE_4' | 'UNDER_8' | 'UNDER_12'
export type ServiceClosureEffect = 'NONE' | 'PAUSE_SEQUENCE'
export type RiskState = 'NONE' | 'APPROACHING_UNDER_ATTENDANCE'

/** Running per-child sequence state carried week to week. */
export interface SequenceState {
  consecutiveUnderAttendanceWeeks: number
  consecutiveAbsenceWeeks: number
}

export const EMPTY_SEQUENCE: SequenceState = {
  consecutiveUnderAttendanceWeeks: 0,
  consecutiveAbsenceWeeks: 0,
}

/** Inputs for one reporting week, after ECCE/non-subsidised hours are excluded. */
export interface WeekInput {
  /** NCS-eligible attended minutes for the week (ECCE/school hours already removed). */
  ncsAttendedMinutes: number
  /** Claimed NCS subsidised minutes for the week (term/non-term already resolved). */
  claimedMinutes: number
  /** True when the child did not attend at all for the full reporting week. */
  fullWeekAbsent: boolean
  /** True when a full service closure applied for the week. */
  serviceClosed?: boolean
}

export interface WeekCompliance extends SequenceState {
  underAttended: boolean
  fullWeekAbsent: boolean
  closureEffect: ServiceClosureEffect
  thresholdEvent: ThresholdEvent
  riskState: RiskState
  /** Weeks remaining until the 8-week under-attendance action, when approaching. */
  weeksUntilUnderThreshold: number | null
}

/**
 * NCS-eligible attended minutes: total attended minus any ECCE/school minutes the
 * child is not NCS-subsidised for. Never negative.
 */
export function ncsEligibleMinutes(totalAttendedMinutes: number, excludedMinutes = 0): number {
  return Math.max(0, Math.round(totalAttendedMinutes) - Math.max(0, Math.round(excludedMinutes)))
}

/** Under-attended = attended strictly less than the claimed subsidised hours. */
export function isUnderAttended(ncsAttendedMinutes: number, claimedMinutes: number): boolean {
  if (claimedMinutes <= 0) return false // nothing claimed ⇒ cannot under-attend
  return Math.round(ncsAttendedMinutes) < Math.round(claimedMinutes)
}

/**
 * Advance the sequence state by one reporting week and derive its compliance.
 *
 * - A full service closure (where the rule pauses) leaves both counters unchanged
 *   and emits no threshold (the sequence resumes after closure).
 * - A full-week absence increments the absence counter; under-attendance (including
 *   an absent week, which is attended < claimed) increments the under counter.
 * - A compliant week (met claimed hours, present) resets both counters to zero.
 * - threshold_event is the single most-severe event reached this week
 *   (UNDER_12 > UNDER_8 > ABSENCE_4 > NONE).
 * - riskState flags the pre-threshold weeks (e.g. 6, 7) before the 8-week action.
 */
export function advanceWeek(
  prior: SequenceState,
  week: WeekInput,
  rules: NcsRules,
): WeekCompliance {
  const underAttended =
    week.fullWeekAbsent || isUnderAttended(week.ncsAttendedMinutes, week.claimedMinutes)

  // Service closure that pauses the sequence: carry counters, no event/risk.
  if (week.serviceClosed && rules.closureHandling === 'PAUSE_SEQUENCE') {
    return {
      consecutiveUnderAttendanceWeeks: prior.consecutiveUnderAttendanceWeeks,
      consecutiveAbsenceWeeks: prior.consecutiveAbsenceWeeks,
      underAttended,
      fullWeekAbsent: week.fullWeekAbsent,
      closureEffect: 'PAUSE_SEQUENCE',
      thresholdEvent: 'NONE',
      riskState: 'NONE',
      weeksUntilUnderThreshold: null,
    }
  }

  const consecutiveAbsenceWeeks = week.fullWeekAbsent ? prior.consecutiveAbsenceWeeks + 1 : 0
  const consecutiveUnderAttendanceWeeks = underAttended
    ? prior.consecutiveUnderAttendanceWeeks + 1
    : 0

  // Most-severe threshold reached this week.
  let thresholdEvent: ThresholdEvent = 'NONE'
  if (consecutiveUnderAttendanceWeeks >= rules.continuedUnderAttendanceWeeks) {
    thresholdEvent = 'UNDER_12'
  } else if (consecutiveUnderAttendanceWeeks >= rules.underAttendanceWeeks) {
    thresholdEvent = 'UNDER_8'
  } else if (consecutiveAbsenceWeeks >= rules.absenceWeeks) {
    thresholdEvent = 'ABSENCE_4'
  }

  // Pre-threshold risk: approaching the 8-week under-attendance action.
  let riskState: RiskState = 'NONE'
  let weeksUntilUnderThreshold: number | null = null
  if (
    thresholdEvent === 'NONE' &&
    consecutiveUnderAttendanceWeeks > 0 &&
    rules.preThresholdWarnWeeks.includes(consecutiveUnderAttendanceWeeks)
  ) {
    riskState = 'APPROACHING_UNDER_ATTENDANCE'
    weeksUntilUnderThreshold = Math.max(
      0,
      rules.underAttendanceWeeks - consecutiveUnderAttendanceWeeks,
    )
  }

  return {
    consecutiveUnderAttendanceWeeks,
    consecutiveAbsenceWeeks,
    underAttended,
    fullWeekAbsent: week.fullWeekAbsent,
    closureEffect: 'NONE',
    thresholdEvent,
    riskState,
    weeksUntilUnderThreshold,
  }
}

/**
 * Fold a chronological series of weeks into their running compliance results.
 * Convenience for back-calculation and for tests that assert on a sequence.
 */
export function runSequence(
  weeks: readonly WeekInput[],
  rules: NcsRules,
  start: SequenceState = EMPTY_SEQUENCE,
): WeekCompliance[] {
  const out: WeekCompliance[] = []
  let state: SequenceState = start
  for (const w of weeks) {
    const r = advanceWeek(state, w, rules)
    out.push(r)
    state = {
      consecutiveUnderAttendanceWeeks: r.consecutiveUnderAttendanceWeeks,
      consecutiveAbsenceWeeks: r.consecutiveAbsenceWeeks,
    }
  }
  return out
}
