// Funding & Hive Centre — Phase 2: NCS claim lifecycle + parent co-payment.
// Pure logic (no DB): the co-payment calculation, the claim status machine, the
// READY validation for the 31 July 2026 mandatory co-payment, and the three-way
// billing reconciliation rule. All money is integer cents.

// ── Claim status machine ───────────────────────────────────────────────────────
export const CLAIM_STATUSES = [
  'DRAFT',
  'READY',
  'VERIFIED',
  'SUBMITTED_EXTERNALLY',
  'SUPERSEDED',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  VERIFIED: 'Verified',
  SUBMITTED_EXTERNALLY: 'Submitted to Hive',
  SUPERSEDED: 'Superseded',
}

export function isClaimStatus(v: string): v is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(v)
}

// DRAFT ⇄ READY → VERIFIED → SUBMITTED_EXTERNALLY; any live state can be SUPERSEDED
// by a newer version. VERIFIED/READY can step back for edits; submitted is terminal
// except being superseded.
const CLAIM_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  DRAFT: ['READY', 'SUPERSEDED'],
  READY: ['DRAFT', 'VERIFIED', 'SUPERSEDED'],
  VERIFIED: ['READY', 'SUBMITTED_EXTERNALLY', 'SUPERSEDED'],
  SUBMITTED_EXTERNALLY: ['SUPERSEDED'],
  SUPERSEDED: [],
}

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  if (from === to) return false
  return CLAIM_TRANSITIONS[from].includes(to)
}

// ── Mandatory co-payment (from 31 July 2026) ───────────────────────────────────
export const CO_PAYMENT_MANDATORY_FROM = '2026-07-31'

/** Whether a claim effective on `date` must carry co-payment information. */
export function copaymentMandatory(effectiveDate: string): boolean {
  return effectiveDate >= CO_PAYMENT_MANDATORY_FROM
}

// ── Co-payment calculation ─────────────────────────────────────────────────────
export interface CopaymentInputs {
  /** Full/agreed weekly fee before any subsidy (cents). */
  weeklyFeeCents: number
  /** NCS subsidy applied this week (cents). */
  ncsSubsidyCents?: number
  /** ECCE subsidy applied this week (cents). */
  ecceSubsidyCents?: number
  /** Service/sibling discounts (cents). */
  discountCents?: number
}

/**
 * Weekly parent co-payment = agreed fee − NCS − ECCE − discounts, never below zero.
 * Inputs are rounded to whole cents; the result and all inputs should be stored as a
 * snapshot so the figure is reproducible.
 */
export function computeCopayment(input: CopaymentInputs): number {
  const fee = Math.max(0, Math.round(input.weeklyFeeCents))
  const subs =
    Math.max(0, Math.round(input.ncsSubsidyCents ?? 0)) +
    Math.max(0, Math.round(input.ecceSubsidyCents ?? 0)) +
    Math.max(0, Math.round(input.discountCents ?? 0))
  return Math.max(0, fee - subs)
}

/** Resolve the claimed childcare minutes for a week, by term/non-term pattern. */
export function claimedMinutesForWeek(
  pattern: { termMinutes: number; nonTermMinutes: number },
  isTermWeek: boolean,
): number {
  return Math.max(0, Math.round(isTermWeek ? pattern.termMinutes : pattern.nonTermMinutes))
}

// ── READY validation ───────────────────────────────────────────────────────────
export interface ClaimReadyInput {
  weeklyFeeCents: number
  termMinutes: number
  nonTermMinutes: number
  startDate: string // ISO
}

type ReadyResult = { ok: true } | { ok: false; missing: string[] }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate that a claim can move to READY. From 31 July 2026 the weekly fee (the
 * co-payment basis) is mandatory. Returns the exact missing fields so the UI can
 * block READY and list them, rather than inventing values.
 */
export function validateClaimReady(input: ClaimReadyInput): ReadyResult {
  const missing: string[] = []
  if (!ISO_DATE.test(input.startDate ?? '')) missing.push('Claim start date')
  if (!(input.termMinutes > 0) && !(input.nonTermMinutes > 0))
    missing.push('Weekly claimed hours (term or non-term)')
  if (copaymentMandatory(input.startDate) && !(input.weeklyFeeCents > 0))
    missing.push('Weekly fee (required for the co-payment)')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

// ── Billing reconciliation ─────────────────────────────────────────────────────
/**
 * Compare the prepared co-payment to what billing actually charges the parent. A
 * difference beyond `toleranceCents` is a mismatch — the caller raises an action
 * rather than silently aligning either side.
 */
export function reconcileCopayment(
  preparedCents: number,
  billedCents: number,
  toleranceCents = 0,
): { matches: boolean; differenceCents: number } {
  const difference = Math.round(preparedCents) - Math.round(billedCents)
  return {
    matches: Math.abs(difference) <= Math.max(0, toleranceCents),
    differenceCents: difference,
  }
}
