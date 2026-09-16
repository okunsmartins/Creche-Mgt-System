import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSchoolsOverview, type SchoolOverviewRow } from './schools'
import { getStripeMrrCents } from './stripeMrr'

// Estimated list prices (cents/month). We store only plan + sms_enabled, not the
// Stripe amount or billing interval — so MRR here is an ESTIMATE that assumes the
// monthly price. Annual plans are over-counted; surface it as "est." in the UI.
const PRO_MONTHLY_CENTS = 3999
const PRO_SMS_MONTHLY_CENTS = 4499

const TRIAL_SOON_DAYS = 7
const COLLECTED_STATUSES = ['paid', 'partially_refunded'] as const

export interface AttentionSchool {
  id: string
  name: string
  trialEndsAt?: string | null
}

export interface PlatformOverview {
  schools: {
    total: number
    withAccess: number
    trialing: number
    paid: number
    free: number
    /** Schools that have been deactivated (soft-deleted); excluded from `total`. */
    deactivated: number
  }
  studentsTotal: number
  /** Net collected this month (paid − refunded), in cents. */
  collectedThisMonthCents: number
  /** MRR in cents — exact from Stripe when available, else the local estimate. */
  mrrCents: number
  mrrSource: 'stripe' | 'estimate'
  sms: { enabledSchools: number }
  attention: {
    trialsExpiringSoon: AttentionSchool[]
    pastDue: AttentionSchool[]
  }
}

/** First day of the current month (UTC) as an ISO timestamp. */
export function monthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/** Estimated monthly revenue (cents) a school contributes — paid (active) only. */
export function estimateMonthlyCents(
  row: Pick<SchoolOverviewRow, 'status' | 'smsEnabled'>,
): number {
  if (row.status !== 'active') return 0 // trials/past_due/none contribute 0 to MRR
  return row.smsEnabled ? PRO_SMS_MONTHLY_CENTS : PRO_MONTHLY_CENTS
}

/** Point-in-time school counts by subscription state. Pure. */
export function summarizeSchools(rows: readonly SchoolOverviewRow[]) {
  let withAccess = 0
  let trialing = 0
  let paid = 0
  let free = 0
  for (const r of rows) {
    if (r.hasAccess) withAccess += 1
    if (r.status === 'trialing') trialing += 1
    else if (r.status === 'active') paid += 1
    if (r.status === 'none' || r.status === 'cancelled' || r.status === 'incomplete') free += 1
  }
  return { total: rows.length, withAccess, trialing, paid, free }
}

/** Schools needing attention: trials ending within TRIAL_SOON_DAYS, and past_due. Pure. */
export function attentionFromRows(rows: readonly SchoolOverviewRow[], now: Date = new Date()) {
  const soonMs = now.getTime() + TRIAL_SOON_DAYS * 24 * 60 * 60 * 1000
  const trialsExpiringSoon: AttentionSchool[] = []
  const pastDue: AttentionSchool[] = []
  for (const r of rows) {
    if (r.status === 'trialing' && r.trialEndsAt) {
      const t = new Date(r.trialEndsAt).getTime()
      if (t >= now.getTime() && t <= soonMs) {
        trialsExpiringSoon.push({ id: r.id, name: r.name, trialEndsAt: r.trialEndsAt })
      }
    }
    if (r.status === 'past_due') pastDue.push({ id: r.id, name: r.name })
  }
  trialsExpiringSoon.sort(
    (a, b) => new Date(a.trialEndsAt ?? 0).getTime() - new Date(b.trialEndsAt ?? 0).getTime(),
  )
  return { trialsExpiringSoon, pastDue }
}

/**
 * Platform-owner Overview: point-in-time KPIs across every school. Deliberately
 * spans all tenants — only reachable behind the `/platform` owner guard. GMV and
 * student counts are read straight from the DB; MRR is an estimate (see note).
 */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const adminClient = createSupabaseAdminClient()

  const { schools: rows } = await getSchoolsOverview()
  const [collectedThisMonthCents, stripeMrr, deactivated] = await Promise.all([
    sumCollectedThisMonthCents(adminClient),
    getStripeMrrCents(),
    countDeactivatedSchools(adminClient),
  ])

  const mrrCents = stripeMrr ?? rows.reduce((sum, r) => sum + estimateMonthlyCents(r), 0)

  return {
    schools: { ...summarizeSchools(rows), deactivated },
    studentsTotal: rows.reduce((sum, r) => sum + r.studentsCount, 0),
    collectedThisMonthCents,
    mrrCents,
    mrrSource: stripeMrr !== null ? 'stripe' : 'estimate',
    sms: { enabledSchools: rows.filter((r) => r.smsEnabled).length },
    attention: attentionFromRows(rows),
  }
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/** How many schools are currently deactivated (is_active = false). */
async function countDeactivatedSchools(adminClient: AdminClient): Promise<number> {
  const { count } = await adminClient
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)
  return count ?? 0
}

async function sumCollectedThisMonthCents(adminClient: AdminClient): Promise<number> {
  const { data } = await adminClient
    .from('payments')
    .select('amount_cents, refunded_amount_cents')
    .in('status', COLLECTED_STATUSES as unknown as string[])
    .gte('paid_at', monthStartIso())
  const rows = (data as { amount_cents: number; refunded_amount_cents: number }[] | null) ?? []
  return rows.reduce((sum, p) => sum + (p.amount_cents - (p.refunded_amount_cents ?? 0)), 0)
}
