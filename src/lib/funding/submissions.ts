// Funding & Hive Centre — immutable submission snapshots / evidence packs (pure).
//
// When a prepared funding return is ready to go to Hive, Creche Wise freezes exactly
// what the figures were at that moment into an immutable snapshot: a canonical JSON
// payload + the rules version + who prepared/verified it, and later the external
// submission evidence. This is the audit trail of "what we told Hive and when" — Hive
// stays the official portal; nothing is submitted automatically. This file is the pure
// part: the kinds, the status machine, and the canonical payload builder (deterministic
// so the same return always serialises identically). The DB-backed actions freeze it.

export const SUBMISSION_PAYLOAD_VERSION = 'submission-1'

/** What a snapshot captures. Extensible — claims/ECCE batches can be added later. */
export const SUBMISSION_KINDS = ['NCS_WEEKLY_RETURN'] as const
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]

export const SUBMISSION_KIND_LABELS: Record<SubmissionKind, string> = {
  NCS_WEEKLY_RETURN: 'NCS weekly return',
}

export function isSubmissionKind(v: string): v is SubmissionKind {
  return (SUBMISSION_KINDS as readonly string[]).includes(v)
}

// ── Status machine ───────────────────────────────────────────────────────────
export const SUBMISSION_STATUSES = ['PREPARED', 'SUBMITTED_EXTERNALLY', 'SUPERSEDED'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  PREPARED: 'Prepared',
  SUBMITTED_EXTERNALLY: 'Submitted to Hive',
  SUPERSEDED: 'Superseded',
}

export function isSubmissionStatus(v: string): v is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(v)
}

// A prepared snapshot can be marked submitted or superseded by a newer prepare; a
// submitted one can only be superseded; superseded is terminal. The frozen payload is
// never edited — a correction is a NEW snapshot that supersedes the old.
const SUBMISSION_TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  PREPARED: ['SUBMITTED_EXTERNALLY', 'SUPERSEDED'],
  SUBMITTED_EXTERNALLY: ['SUPERSEDED'],
  SUPERSEDED: [],
}

export function canTransitionSubmission(from: SubmissionStatus, to: SubmissionStatus): boolean {
  if (from === to) return false
  return SUBMISSION_TRANSITIONS[from].includes(to)
}

// ── Canonical NCS weekly-return payload ──────────────────────────────────────
export interface WeeklyReturnRow {
  studentId: string
  childName: string
  claimedMinutes: number
  actualMinutes: number
  consecutiveUnderWeeks: number
  consecutiveAbsenceWeeks: number
  thresholdEvent: string
  riskState: string
}

export interface WeeklyReturnPayload {
  payloadVersion: string
  kind: 'NCS_WEEKLY_RETURN'
  weekStart: string
  calculationVersion: string | null
  total: number
  reviewCount: number
  rows: WeeklyReturnRow[]
}

/**
 * Build the canonical, immutable payload for an NCS weekly-return snapshot. Rows are
 * sorted by studentId so the serialisation is deterministic regardless of query order,
 * and stamped with a payload version so a stored snapshot can always be interpreted.
 */
export function buildWeeklyReturnPayload(args: {
  weekStart: string
  calculationVersion: string | null
  total: number
  rows: WeeklyReturnRow[]
}): WeeklyReturnPayload {
  const rows = [...args.rows].sort((a, b) =>
    a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0,
  )
  return {
    payloadVersion: SUBMISSION_PAYLOAD_VERSION,
    kind: 'NCS_WEEKLY_RETURN',
    weekStart: args.weekStart,
    calculationVersion: args.calculationVersion,
    total: args.total,
    reviewCount: rows.length,
    rows,
  }
}
