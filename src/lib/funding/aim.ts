// Funding & Hive Centre — Phase 5: AIM (Access and Inclusion Model) pure domain.
//
// AIM supports a child's participation in ECCE. It is the most SENSITIVE funding
// domain: it concerns a child's additional needs, so Creche Wise treats it as a
// restricted case file — gated behind its own `funding.manage_aim` permission,
// requiring recorded parental/guardian CONSENT before anything is prepared for Hive,
// and deliberately holding only a brief non-clinical support summary (never general
// health or developmental records, which stay in their own modules). This file is the
// pure logic: the case status machine, the consent states, and the readiness rule.
// No DB, no identifiers — fully unit-testable.

/** AIM levels 1–7 (Level 7 = additional assistance in the preschool room). */
export const AIM_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const
export type AimLevel = (typeof AIM_LEVELS)[number]

export function isAimLevel(n: number): n is AimLevel {
  return (AIM_LEVELS as readonly number[]).includes(n)
}

// ── Case status machine ──────────────────────────────────────────────────────
export const AIM_STATUSES = [
  'PREPARING',
  'CONSENT_RECORDED',
  'READY',
  'SUBMITTED_EXTERNALLY',
  'CLOSED',
] as const
export type AimStatus = (typeof AIM_STATUSES)[number]

export const AIM_STATUS_LABELS: Record<AimStatus, string> = {
  PREPARING: 'Preparing',
  CONSENT_RECORDED: 'Consent recorded',
  READY: 'Ready',
  SUBMITTED_EXTERNALLY: 'Submitted to Hive',
  CLOSED: 'Closed',
}

export function isAimStatus(v: string): v is AimStatus {
  return (AIM_STATUSES as readonly string[]).includes(v)
}

// PREPARING → CONSENT_RECORDED → READY → SUBMITTED_EXTERNALLY; any live state can be
// CLOSED. READY/SUBMITTED can step back for edits. CLOSED is terminal (a new case is
// created if work resumes) — this keeps a closed sensitive file from silently reopening.
const AIM_TRANSITIONS: Record<AimStatus, readonly AimStatus[]> = {
  PREPARING: ['CONSENT_RECORDED', 'CLOSED'],
  CONSENT_RECORDED: ['READY', 'PREPARING', 'CLOSED'],
  READY: ['SUBMITTED_EXTERNALLY', 'CONSENT_RECORDED', 'CLOSED'],
  SUBMITTED_EXTERNALLY: ['CLOSED'],
  CLOSED: [],
}

export function canTransitionAim(from: AimStatus, to: AimStatus): boolean {
  if (from === to) return false
  return AIM_TRANSITIONS[from].includes(to)
}

// ── Consent ──────────────────────────────────────────────────────────────────
// AIM cannot be prepared for Hive without recorded parental/guardian consent.
export const AIM_CONSENT_STATUSES = [
  'NOT_REQUESTED',
  'REQUESTED',
  'GRANTED',
  'DECLINED',
  'WITHDRAWN',
] as const
export type AimConsentStatus = (typeof AIM_CONSENT_STATUSES)[number]

export const AIM_CONSENT_LABELS: Record<AimConsentStatus, string> = {
  NOT_REQUESTED: 'Not requested',
  REQUESTED: 'Requested',
  GRANTED: 'Granted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
}

export function isAimConsentStatus(v: string): v is AimConsentStatus {
  return (AIM_CONSENT_STATUSES as readonly string[]).includes(v)
}

/** Consent must be explicitly GRANTED before an AIM case can be readied/submitted. */
export function consentAllowsPreparation(status: AimConsentStatus): boolean {
  return status === 'GRANTED'
}

// ── Readiness ────────────────────────────────────────────────────────────────
export interface AimReadyInput {
  level: number | null
  consentStatus: AimConsentStatus
  supportSummary: string | null
}

type ReadyResult = { ok: true } | { ok: false; missing: string[] }

/**
 * Validate that an AIM case can move to READY / be submitted. Lists the exact missing
 * prerequisites so the UI can block the step rather than inventing data. Consent is a
 * hard gate — without it, nothing about the child goes to Hive.
 */
export function validateAimReady(input: AimReadyInput): ReadyResult {
  const missing: string[] = []
  if (input.level == null || !isAimLevel(input.level)) missing.push('AIM level (1–7)')
  if (!consentAllowsPreparation(input.consentStatus))
    missing.push('Recorded parental/guardian consent (granted)')
  if (!input.supportSummary || input.supportSummary.trim().length === 0)
    missing.push('Support summary')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
