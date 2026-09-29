// FEE-06: invoice generation. Turns a child's fee schedule (+ their ECCE/NCS
// awards) into the year's dated, subvention-netted invoice drafts.
//
// Design (see docs/design/fee-subvention-engine.md §3): money maths is WEEKLY —
// ECCE and NCS are weekly concepts — so we compute every week with the tested
// subvention engine, then GROUP the weeks into billing periods for presentation
// (weekly = 1 week/invoice, fortnightly = 2, monthly = calendar month, annually =
// all). Weeks sum exactly into their period, so no cents are lost.
//
// Pure + unit-tested; no DB. The server action (actions.ts) supplies the inputs
// from fee_schedules + child_funding_registrations and persists the drafts.

import { type FeeFrequency } from './schedule'
import {
  computeWeekSubvention,
  type WeekInput,
  type EcceAward,
  type NcsAward,
  type EcceConfig,
  type WeekSubvention,
} from '../payments/subvention'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtc(iso: string): Date {
  const m = iso.match(ISO)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
}

function fromUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export interface InvoiceDraft {
  /** First day covered by this invoice (inclusive). */
  periodStart: string
  /** Last day covered by this invoice (inclusive). */
  periodEnd: string
  /** When the parent should pay — the start of the period for now. */
  dueDate: string
  grossParentCents: number
  ecceZeroRatedHours: number
  ncsSubsidisedHours: number
  ncsSubsidyCents: number
  netParentCents: number
  providerReceivableEcceCents: number
  providerReceivableNcsCents: number
  /** Per-week breakdown — the immutable snapshot stored on the invoice at issue. */
  weeks: WeekSubvention[]
}

export interface BuildInvoiceParams {
  frequency: FeeFrequency
  /** Schedule window (inclusive), 'YYYY-MM-DD'. */
  startISO: string
  endISO: string
  /** Hours-based fee: provider's commercial rate + contracted hours per operating day. */
  providerHourlyRateCents?: number
  contractedDayHours?: number[]
  /** Flat-fee alternative (fixed charge per period, no hours/subvention maths). */
  flatAmountCents?: number
  /** The child's ECCE/NCS awards as they apply across the window. */
  ecce?: EcceAward | null
  ncs?: NcsAward | null
  ecceConfig?: EcceConfig
  /**
   * ISO week-start dates that fall inside the ECCE programme term. If omitted and
   * ECCE is active, every week is treated as a term week (caller can pass the real
   * ~38-week term calendar for accuracy). Ignored when ECCE is inactive.
   */
  ecceTermWeekStarts?: string[]
}

/** Weekly step from start to end (inclusive), used as the subvention unit. */
function weekStarts(startISO: string, endISO: string): string[] {
  if (toUtc(startISO) > toUtc(endISO)) return []
  const out: string[] = []
  let cur = startISO
  let guard = 0
  while (toUtc(cur) <= toUtc(endISO) && guard < 520) {
    out.push(cur)
    cur = addDays(cur, 7)
    guard++
  }
  return out
}

/** The period-bucket key for a given week-start under a frequency. */
function bucketIndex(frequency: FeeFrequency, weekIdx: number, weekStart: string, firstWeek: string): string {
  switch (frequency) {
    case 'weekly':
      return String(weekIdx)
    case 'fortnightly':
      return String(Math.floor(weekIdx / 2))
    case 'monthly': {
      const d = toUtc(weekStart)
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    }
    case 'annually': {
      // Group by 12-month blocks from the first week.
      const start = toUtc(firstWeek)
      const d = toUtc(weekStart)
      const months = (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + (d.getUTCMonth() - start.getUTCMonth())
      return String(Math.floor(months / 12))
    }
  }
}

const emptyDraft = (periodStart: string): InvoiceDraft => ({
  periodStart,
  periodEnd: periodStart,
  dueDate: periodStart,
  grossParentCents: 0,
  ecceZeroRatedHours: 0,
  ncsSubsidisedHours: 0,
  ncsSubsidyCents: 0,
  netParentCents: 0,
  providerReceivableEcceCents: 0,
  providerReceivableNcsCents: 0,
  weeks: [],
})

/**
 * Build invoice drafts for a fee schedule across its window.
 *
 * Hours-based schedules run the weekly subvention engine and group weeks into
 * billing periods. Flat-fee schedules produce one equal charge per period with no
 * subvention (a fixed fee has no hours for ECCE/NCS to act on).
 */
export function buildInvoiceDrafts(params: BuildInvoiceParams): InvoiceDraft[] {
  const { frequency, startISO, endISO } = params

  const weeks = weekStarts(startISO, endISO)
  if (weeks.length === 0) return []

  const firstWeek = weeks[0]!
  const buckets = new Map<string, InvoiceDraft>()
  const order: string[] = []

  const ecceActive = Boolean(params.ecce?.active)
  const termSet = params.ecceTermWeekStarts ? new Set(params.ecceTermWeekStarts) : null

  weeks.forEach((weekStart, i) => {
    const key = bucketIndex(frequency, i, weekStart, firstWeek)
    if (!buckets.has(key)) {
      buckets.set(key, emptyDraft(weekStart))
      order.push(key)
    }
    const draft = buckets.get(key)!

    let week: WeekSubvention
    if (params.flatAmountCents != null) {
      // Flat fee: no hours, no subvention. Whole charge lands on the first week of
      // each period so periods sum exactly to the flat amount.
      const isFirstWeekOfBucket = draft.weeks.length === 0
      const gross = isFirstWeekOfBucket ? Math.max(0, Math.round(params.flatAmountCents)) : 0
      week = {
        billableHours: 0,
        ecceHours: 0,
        grossParentCents: gross,
        ncsSubsidisedHours: 0,
        ncsSubsidyCents: 0,
        netParentCents: gross,
        providerEcceCapitationCents: 0,
        providerNcsSubsidyCents: 0,
      }
    } else {
      const isEcceTermWeek = ecceActive ? (termSet ? termSet.has(weekStart) : true) : false
      const weekInput: WeekInput = {
        providerHourlyRateCents: params.providerHourlyRateCents ?? 0,
        dayHours: params.contractedDayHours ?? [],
        isEcceTermWeek,
        ecce: params.ecce ?? null,
        ncs: params.ncs ?? null,
      }
      // Only set ecceConfig when supplied (exactOptionalPropertyTypes).
      if (params.ecceConfig) weekInput.ecceConfig = params.ecceConfig
      week = computeWeekSubvention(weekInput)
    }

    draft.weeks.push(week)
    draft.periodEnd = addDays(weekStart, 6)
    draft.grossParentCents += week.grossParentCents
    draft.ecceZeroRatedHours += week.ecceHours
    draft.ncsSubsidisedHours += week.ncsSubsidisedHours
    draft.ncsSubsidyCents += week.ncsSubsidyCents
    draft.netParentCents += week.netParentCents
    draft.providerReceivableEcceCents += week.providerEcceCapitationCents
    draft.providerReceivableNcsCents += week.providerNcsSubsidyCents
  })

  return order.map((k) => buckets.get(k)!)
}

/** Total the parent pays across all drafts, cents. */
export function totalNetCents(drafts: InvoiceDraft[]): number {
  return drafts.reduce((s, d) => s + d.netParentCents, 0)
}
