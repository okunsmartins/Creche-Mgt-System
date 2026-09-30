// FEE-08.5 / spec §8.5 — full-year fee projection (the "magic wand": see the year's
// obligations at a glance, not chase week to week). Pure + unit-tested.
//
// Combines the schedule's due dates (what SHOULD be billed across the window) with the
// invoices actually generated (what IS billed / paid / outstanding), so a manager sees
// invoiced vs projected, total paid, outstanding, and the next due date.

export interface ProjectionInvoice {
  dueDate: string // YYYY-MM-DD
  netParentCents: number
  amountPaidCents: number
  status: string // draft | issued | paid | part_paid | void
}

export interface FeeYearProjection {
  totalPeriods: number
  invoicedPeriods: number
  /** Scheduled periods with no invoice yet (future obligations). */
  projectedPeriods: number
  invoicedCents: number
  paidCents: number
  outstandingCents: number
  /** Earliest due date still owing (unpaid/part-paid invoice, else next scheduled). */
  nextDueDate: string | null
}

const COUNTS_AS_OWED = new Set(['issued', 'part_paid'])

/**
 * Project a child's fee year from the schedule's `dueDates` and the `invoices` created
 * for it. Void invoices are ignored. `outstanding` sums unpaid balances of
 * issued/part-paid invoices; `nextDueDate` is the earliest still-owing invoice, or the
 * first scheduled date on/after today with no invoice yet.
 */
export function summariseFeeYear(params: {
  dueDates: ReadonlyArray<string>
  invoices: ReadonlyArray<ProjectionInvoice>
  todayISO: string
}): FeeYearProjection {
  const live = params.invoices.filter((i) => i.status !== 'void')
  const invoicedDates = new Set(live.map((i) => i.dueDate))

  const invoicedCents = live.reduce((s, i) => s + i.netParentCents, 0)
  const paidCents = live.reduce((s, i) => s + i.amountPaidCents, 0)
  const outstandingCents = live
    .filter((i) => COUNTS_AS_OWED.has(i.status))
    .reduce((s, i) => s + Math.max(0, i.netParentCents - i.amountPaidCents), 0)

  const totalPeriods = params.dueDates.length
  const invoicedPeriods = params.dueDates.filter((d) => invoicedDates.has(d)).length
  const projectedPeriods = Math.max(0, totalPeriods - invoicedPeriods)

  // Next due: earliest still-owing invoice; else first scheduled uninvoiced date >= today.
  const owingDue = live
    .filter((i) => COUNTS_AS_OWED.has(i.status) && i.netParentCents - i.amountPaidCents > 0)
    .map((i) => i.dueDate)
    .sort()
  let nextDueDate: string | null = owingDue[0] ?? null
  if (!nextDueDate) {
    nextDueDate =
      params.dueDates.filter((d) => d >= params.todayISO && !invoicedDates.has(d)).sort()[0] ?? null
  }

  return {
    totalPeriods,
    invoicedPeriods,
    projectedPeriods,
    invoicedCents,
    paidCents,
    outstandingCents,
    nextDueDate,
  }
}
