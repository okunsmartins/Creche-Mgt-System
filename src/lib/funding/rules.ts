// Funding & Hive Centre — programme-year-aware NCS rule configuration.
// Pure + versioned so changes to thresholds/deadlines never require rewriting the
// application, and historic snapshots can be reproduced from their rules_version.
// (Phase 1. Deadlines/co-payment-field rules extend this in later phases.)

/** Thresholds + warning rules for the NCS weekly compliance engine. */
export interface NcsRules {
  /** Consecutive full-week absences that trigger a 4-week action. */
  absenceWeeks: number
  /** Consecutive under-attendance weeks that trigger the 8-week action. */
  underAttendanceWeeks: number
  /** Consecutive under-attendance weeks that trigger the continued (12-week) action. */
  continuedUnderAttendanceWeeks: number
  /** Pre-threshold weeks at which to raise an approaching-risk warning (e.g. 6, 7). */
  preThresholdWarnWeeks: readonly number[]
  /** How a full service closure affects the sequences. */
  closureHandling: 'PAUSE_SEQUENCE' | 'COUNT_AS_ABSENCE'
}

/** Identifier stamped onto every snapshot so a calculation can be reproduced. */
export const CURRENT_NCS_RULES_VERSION = 'ncs-2026.1'

/**
 * NCS rules effective for the 2026 policy (guidelines effective 5 June 2026):
 * 4-week continuous absence, 8-week under-attendance, 12-week continued
 * under-attendance; pre-threshold warnings at weeks 6 and 7; full service
 * closures pause the sequence rather than counting as child under-attendance.
 * ⚠️ Confirm against the current Pobal/NCS circular before go-live.
 */
export const NCS_RULES_2026: NcsRules = {
  absenceWeeks: 4,
  underAttendanceWeeks: 8,
  continuedUnderAttendanceWeeks: 12,
  preThresholdWarnWeeks: [6, 7],
  closureHandling: 'PAUSE_SEQUENCE',
}

const BY_VERSION: Record<string, NcsRules> = {
  [CURRENT_NCS_RULES_VERSION]: NCS_RULES_2026,
}

/** Resolve the NCS rules for a given programme year (falls back to current). */
export function resolveNcsRules(_programmeYear?: string | null): NcsRules {
  // Single version for now; programme-year selection wires in once more than one
  // version exists (keyed via funding_programme_config.rules_version).
  return NCS_RULES_2026
}

/** Resolve a specific rules version (for reproducing a historic snapshot). */
export function ncsRulesByVersion(version: string): NcsRules | null {
  return BY_VERSION[version] ?? null
}
