// Authorised collectors (Feature B, design doc:
// docs/design/school-collection-and-authorised-collectors.md). Pure catalog +
// validation + status machine. No DB, no node:crypto — safe to import from client
// components, server actions and tests alike. Password hashing lives separately in
// ./password (server-only) so this stays bundler-safe for the client forms.

export const COLLECTOR_STATUSES = ['pending', 'approved', 'declined', 'revoked'] as const
export type CollectorStatus = (typeof COLLECTOR_STATUSES)[number]

export const COLLECTOR_STATUS_LABELS: Record<CollectorStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  declined: 'Declined',
  revoked: 'Revoked',
}

export const COLLECTOR_RELATIONSHIPS = [
  'parent',
  'guardian',
  'grandparent',
  'aunt_uncle',
  'sibling',
  'childminder',
  'other',
] as const
export type CollectorRelationship = (typeof COLLECTOR_RELATIONSHIPS)[number]

export const COLLECTOR_RELATIONSHIP_LABELS: Record<CollectorRelationship, string> = {
  parent: 'Parent',
  guardian: 'Guardian',
  grandparent: 'Grandparent',
  aunt_uncle: 'Aunt / Uncle',
  sibling: 'Sibling',
  childminder: 'Childminder',
  other: 'Other',
}

/** Who may originate a collector record (design decision: both). */
export const COLLECTOR_PROPOSERS = ['parent', 'staff'] as const
export type CollectorProposer = (typeof COLLECTOR_PROPOSERS)[number]

export function isCollectorStatus(v: string): v is CollectorStatus {
  return (COLLECTOR_STATUSES as readonly string[]).includes(v)
}

export function isCollectorRelationship(v: string): v is CollectorRelationship {
  return (COLLECTOR_RELATIONSHIPS as readonly string[]).includes(v)
}

// Loose phone check: optional, but if given must look like a plausible number
// (digits, spaces, +, -, parentheses; at least 7 digits). Strict E.164 is handled
// elsewhere (lib/sms/phone) for SMS; collectors just need a contact number.
const PHONE_RE = /^[+\d][\d\s()-]{6,}$/
const PHONE_DIGITS_RE = /\d/g

export interface CollectorInput {
  fullName: string
  relationship: string
  phone?: string | null
}

/** Validate before insert: name + a valid relationship required; phone optional but sane. */
export function validateCollector(
  input: CollectorInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.fullName?.trim()) return { ok: false, error: "The collector's full name is required." }
  if (!isCollectorRelationship(input.relationship))
    return { ok: false, error: 'Choose a valid relationship.' }
  const phone = input.phone?.trim()
  if (phone) {
    const digits = (phone.match(PHONE_DIGITS_RE) ?? []).length
    if (!PHONE_RE.test(phone) || digits < 7)
      return { ok: false, error: 'Enter a valid phone number.' }
  }
  return { ok: true }
}

/**
 * Status machine. pending → approved/declined (a review decision); approved →
 * revoked (withdraw access later); declined → approved (reconsider). Terminal-ish
 * states can't silently flip back to pending. Returns whether the move is allowed.
 */
const ALLOWED_TRANSITIONS: Record<CollectorStatus, readonly CollectorStatus[]> = {
  pending: ['approved', 'declined'],
  approved: ['revoked'],
  declined: ['approved'],
  revoked: ['approved'],
}

export function canTransitionCollector(from: CollectorStatus, to: CollectorStatus): boolean {
  if (from === to) return false
  return ALLOWED_TRANSITIONS[from].includes(to)
}
