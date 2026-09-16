import { getSchoolsOverview, type SchoolOverviewRow } from './schools'
import { estimateMonthlyCents } from './overview'
import { getStripeMrrCents } from './stripeMrr'

export interface TopSchool {
  id: string
  name: string
  collectedCents: number
}

export interface RevenueOverview {
  mrrCents: number
  mrrSource: 'stripe' | 'estimate'
  arrCents: number
  funnel: { trialing: number; active: number; pastDue: number; churned: number }
  /**
   * Past-trial conversion (%): of schools whose trial has ended, the share now
   * paying = active / (active + churned). Null when none are past trial.
   * Point-in-time only — true cohort conversion needs event history we don't keep.
   */
  pastTrialConversionPct: number | null
  topSchools: TopSchool[]
}

/** active / (active + churned) as a rounded %, or null when the denominator is 0. Pure. */
export function pastTrialConversion(active: number, churned: number): number | null {
  const denom = active + churned
  if (denom === 0) return null
  return Math.round((active / denom) * 100)
}

/** Subscription funnel counts from school rows. `none` (no subscription) is excluded. Pure. */
export function funnelFromRows(rows: readonly SchoolOverviewRow[]) {
  let trialing = 0
  let active = 0
  let pastDue = 0
  let churned = 0
  for (const r of rows) {
    switch (r.status) {
      case 'trialing':
        trialing += 1
        break
      case 'active':
        active += 1
        break
      case 'past_due':
        pastDue += 1
        break
      case 'cancelled':
      case 'incomplete':
        churned += 1
        break
      default:
        break // 'none' → no subscription; not part of the funnel
    }
  }
  return { trialing, active, pastDue, churned }
}

/** Revenue/subscriptions view for the platform owner. Reuses the enriched school
 *  rows (per-school revenue) and exact Stripe MRR when available. */
export async function getRevenueOverview(): Promise<RevenueOverview> {
  const { schools: rows } = await getSchoolsOverview()
  const stripeMrr = await getStripeMrrCents()

  const mrrCents = stripeMrr ?? rows.reduce((sum, r) => sum + estimateMonthlyCents(r), 0)
  const funnel = funnelFromRows(rows)
  const topSchools = rows
    .map((r) => ({ id: r.id, name: r.name, collectedCents: r.collectedCents }))
    .filter((r) => r.collectedCents > 0)
    .sort((a, b) => b.collectedCents - a.collectedCents)
    .slice(0, 5)

  return {
    mrrCents,
    mrrSource: stripeMrr !== null ? 'stripe' : 'estimate',
    arrCents: mrrCents * 12,
    funnel,
    pastTrialConversionPct: pastTrialConversion(funnel.active, funnel.churned),
    topSchools,
  }
}
