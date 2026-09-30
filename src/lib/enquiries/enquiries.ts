// Enquiries / waiting-list CRM (spec §7.3). Pure catalog + validation. No DB.

export const ENQUIRY_STATUSES = [
  'new',
  'contacted',
  'waitlisted',
  'offered',
  'enrolled',
  'declined',
] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  waitlisted: 'Waitlisted',
  offered: 'Offered',
  enrolled: 'Enrolled',
  declined: 'Declined',
}

/** Statuses that are still "open" (in the active pipeline, not closed out). */
export const OPEN_ENQUIRY_STATUSES: readonly EnquiryStatus[] = [
  'new',
  'contacted',
  'waitlisted',
  'offered',
]

export function isEnquiryStatus(v: string): v is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(v)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface EnquiryInput {
  parentName: string
  parentEmail?: string | null
}

/** Validate before insert: a parent name is required; email (if given) must look valid. */
export function validateEnquiry(input: EnquiryInput): { ok: true } | { ok: false; error: string } {
  if (!input.parentName?.trim()) return { ok: false, error: 'A parent/guardian name is required.' }
  const email = input.parentEmail?.trim()
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  return { ok: true }
}
