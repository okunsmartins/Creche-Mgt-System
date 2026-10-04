// Funding & Hive Centre — Phase 3: Programme Readiness (pure).
// The annual preconditions a provider must have in place before funding agreements
// can be activated for a programme year (2026/2027 guidance). Each item tracks a
// status; the dashboard surfaces the outstanding ones with deadlines.

export const READINESS_STATUSES = [
  'CURRENT',
  'REVIEW_REQUIRED',
  'MISSING',
  'SUBMITTED',
  'NOT_APPLICABLE',
] as const
export type ReadinessStatus = (typeof READINESS_STATUSES)[number]

export const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  CURRENT: 'Current',
  REVIEW_REQUIRED: 'Review required',
  MISSING: 'Missing',
  SUBMITTED: 'Submitted',
  NOT_APPLICABLE: 'Not applicable',
}

export function isReadinessStatus(v: string): v is ReadinessStatus {
  return (READINESS_STATUSES as readonly string[]).includes(v)
}

/** A status that still needs attention (not current/submitted/not-applicable). */
export function isOutstanding(status: ReadinessStatus): boolean {
  return status === 'REVIEW_REQUIRED' || status === 'MISSING'
}

export interface ReadinessItemDef {
  key: string
  label: string
  category: string
}

/**
 * The 2026/2027 Programme Readiness checklist. Seeded per tenant per programme year
 * when a readiness instance is created; the source record each links to is wired in
 * the service layer where an equivalent exists in Creche Wise.
 */
export const PROGRAMME_READINESS_2026_2027: ReadinessItemDef[] = [
  {
    key: 'organisation_details',
    label: 'Organisation details up to date',
    category: 'Organisation',
  },
  {
    key: 'service_provider_details',
    label: 'Service-provider details up to date',
    category: 'Organisation',
  },
  { key: 'primary_authorised_user', label: 'Primary Authorised User set', category: 'Users' },
  { key: 'portal_users', label: 'Portal users reviewed', category: 'Users' },
  { key: 'bank_account', label: 'Bank account verified', category: 'Finance' },
  { key: 'tusla_registration', label: 'Tusla registration current', category: 'Compliance' },
  {
    key: 'ecce_minimum_numbers',
    label: 'ECCE minimum numbers met (where relevant)',
    category: 'ECCE',
  },
  { key: 'fee_table', label: 'Programme-year Fee Table submitted', category: 'Fees' },
  { key: 'service_calendar', label: 'Service Calendar(s) submitted', category: 'Calendar' },
  { key: 'parent_statement', label: 'Parent Statement updated', category: 'Fees' },
]

export interface ReadinessSummary {
  total: number
  outstanding: number
  current: number
  submitted: number
  notApplicable: number
}

export function readinessSummary(
  items: ReadonlyArray<{ status: ReadinessStatus }>,
): ReadinessSummary {
  const s: ReadinessSummary = {
    total: items.length,
    outstanding: 0,
    current: 0,
    submitted: 0,
    notApplicable: 0,
  }
  for (const i of items) {
    if (isOutstanding(i.status)) s.outstanding++
    else if (i.status === 'CURRENT') s.current++
    else if (i.status === 'SUBMITTED') s.submitted++
    else if (i.status === 'NOT_APPLICABLE') s.notApplicable++
  }
  return s
}
