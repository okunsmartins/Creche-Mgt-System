// School Collection Service (Feature A, design doc:
// docs/design/school-collection-and-authorised-collectors.md). Slice 1: collection
// methods + runs configuration. Pure catalog + validation + charge/ratio maths.
// No DB — safe for client, server and tests.

import { requiredStaff } from '@/lib/ratios/ratio'

// ── Charge basis (per-crèche dropdown; chosen per run) ────────────────────────
export const CHARGE_BASES = ['per_day', 'weekly', 'per_term'] as const
export type ChargeBasis = (typeof CHARGE_BASES)[number]

export const CHARGE_BASIS_LABELS: Record<ChargeBasis, string> = {
  per_day: 'Per day',
  weekly: 'Weekly',
  per_term: 'Per term',
}

/** Unit noun for a charge basis, for UI ("€10 per day", "× 3 days"). */
export const CHARGE_BASIS_UNIT: Record<ChargeBasis, string> = {
  per_day: 'day',
  weekly: 'week',
  per_term: 'term',
}

export function isChargeBasis(v: string): v is ChargeBasis {
  return (CHARGE_BASES as readonly string[]).includes(v)
}

// ── Collection ratio ──────────────────────────────────────────────────────────
// Reference chaperone:child ratio for the school run (school-age). ⚠️ CONFIRM with
// Tusla School-Age regs; configurable per run via `childrenPerChaperone`.
export const DEFAULT_COLLECTION_RATIO = 4

/** Minimum chaperones to collect `children` at the run's ratio. */
export function runRequiredChaperones(
  children: number,
  childrenPerChaperone: number = DEFAULT_COLLECTION_RATIO,
): number {
  return requiredStaff(children, childrenPerChaperone)
}

export interface RunStaffingAssessment {
  enrolled: number
  staffAssigned: number
  requiredChaperones: number
  /** staffAssigned >= requiredChaperones */
  ratioMet: boolean
  /** More children the assigned staff could collect at this ratio. */
  spareCapacity: number
}

/** Assess a run: are enough chaperones assigned for the enrolled children? */
export function assessRunStaffing(
  enrolled: number,
  staffAssigned: number,
  childrenPerChaperone: number = DEFAULT_COLLECTION_RATIO,
): RunStaffingAssessment {
  const cpc = Math.max(1, Math.floor(childrenPerChaperone))
  const kids = Math.max(0, Math.floor(enrolled))
  const staff = Math.max(0, Math.floor(staffAssigned))
  const required = runRequiredChaperones(kids, cpc)
  return {
    enrolled: kids,
    staffAssigned: staff,
    requiredChaperones: required,
    ratioMet: staff >= required,
    spareCapacity: Math.max(0, staff * cpc - kids),
  }
}

// ── Charge computation ────────────────────────────────────────────────────────
/**
 * Amount (integer cents) for `units` of the run at its price. `units` is the count
 * for the basis: days for per_day, weeks for weekly, terms for per_term (default 1).
 * Never negative; units floored to a whole non-negative number.
 */
export function computeCollectionCharge(priceCents: number, units: number = 1): number {
  const price = Math.max(0, Math.round(priceCents))
  const n = Math.max(0, Math.floor(units))
  return price * n
}

// ── Days of week (ISO: 1 = Mon … 7 = Sun) ─────────────────────────────────────
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

/** Normalise + validate a day list: unique ints 1–7, sorted. */
export function normaliseDays(days: ReadonlyArray<number>): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort(
    (a, b) => a - b,
  )
}

export function formatDays(days: ReadonlyArray<number>): string {
  const norm = normaliseDays(days)
  return norm.length ? norm.map((d) => WEEKDAY_LABELS[d]).join(', ') : '—'
}

// ── Validation ────────────────────────────────────────────────────────────────
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type Result = { ok: true } | { ok: false; error: string }

export function validateCollectionMethod(input: { label: string }): Result {
  if (!input.label?.trim()) return { ok: false, error: 'A method name is required.' }
  return { ok: true }
}

export interface CollectionRunInput {
  name: string
  originSchoolName: string
  days: ReadonlyArray<number>
  pickupTime?: string | null
  capacity: number
  chargeBasis: string
  priceCents: number
  childrenPerChaperone?: number
}

// ── Enrolment status machine (Slice 2) ───────────────────────────────────────
export const ENROLMENT_STATUSES = ['requested', 'approved', 'declined', 'ended'] as const
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number]

export const ENROLMENT_STATUS_LABELS: Record<EnrolmentStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  declined: 'Declined',
  ended: 'Ended',
}

export function isEnrolmentStatus(v: string): v is EnrolmentStatus {
  return (ENROLMENT_STATUSES as readonly string[]).includes(v)
}

// requested → approved/declined (a review decision); approved → ended (stop the
// enrolment); declined/ended → approved (reinstate). No silent return to requested.
const ENROLMENT_TRANSITIONS: Record<EnrolmentStatus, readonly EnrolmentStatus[]> = {
  requested: ['approved', 'declined'],
  approved: ['ended'],
  declined: ['approved'],
  ended: ['approved'],
}

export function canTransitionEnrolment(from: EnrolmentStatus, to: EnrolmentStatus): boolean {
  if (from === to) return false
  return ENROLMENT_TRANSITIONS[from].includes(to)
}

// ── Daily collection register (Slice 3) ───────────────────────────────────────
// The lifecycle of one child on one collection day: scheduled → collected (from
// school) → released (to an authorised collector), or marked absent. Undo paths let
// staff correct a mistake.
export const REGISTER_STATUSES = ['scheduled', 'collected', 'released', 'absent'] as const
export type RegisterStatus = (typeof REGISTER_STATUSES)[number]

export const REGISTER_STATUS_LABELS: Record<RegisterStatus, string> = {
  scheduled: 'Scheduled',
  collected: 'Collected from school',
  released: 'Released to collector',
  absent: 'Absent',
}

export function isRegisterStatus(v: string): v is RegisterStatus {
  return (REGISTER_STATUSES as readonly string[]).includes(v)
}

const REGISTER_TRANSITIONS: Record<RegisterStatus, readonly RegisterStatus[]> = {
  scheduled: ['collected', 'absent'],
  collected: ['released', 'scheduled'],
  released: ['collected'],
  absent: ['scheduled'],
}

export function canTransitionRegister(from: RegisterStatus, to: RegisterStatus): boolean {
  if (from === to) return false
  return REGISTER_TRANSITIONS[from].includes(to)
}

export function validateCollectionRun(input: CollectionRunInput): Result {
  if (!input.name?.trim()) return { ok: false, error: 'A run name is required.' }
  if (!input.originSchoolName?.trim())
    return { ok: false, error: 'The school children are collected from is required.' }
  if (normaliseDays(input.days).length === 0)
    return { ok: false, error: 'Select at least one collection day.' }
  if (input.pickupTime && !TIME_RE.test(input.pickupTime))
    return { ok: false, error: 'Enter a valid pickup time (HH:MM).' }
  if (!Number.isInteger(input.capacity) || input.capacity < 1)
    return { ok: false, error: 'Capacity must be at least 1.' }
  if (!isChargeBasis(input.chargeBasis)) return { ok: false, error: 'Choose a charge basis.' }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0)
    return { ok: false, error: 'Enter a valid price.' }
  if (
    input.childrenPerChaperone !== undefined &&
    (!Number.isInteger(input.childrenPerChaperone) || input.childrenPerChaperone < 1)
  )
    return { ok: false, error: 'Children per chaperone must be at least 1.' }
  return { ok: true }
}
