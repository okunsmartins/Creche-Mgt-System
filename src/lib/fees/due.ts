// Fees/invoices "due by period" view (admin). Pure + unit-tested.
//
// Buckets issued/part-paid invoices with an outstanding parent balance by their due
// date relative to "today": overdue, due today, due this week, due this month, due
// this year, and later. Each invoice falls in exactly ONE bucket (its tightest
// horizon); the period cards sum the cumulative horizons from today.

export type DueBucket = 'overdue' | 'today' | 'week' | 'month' | 'year' | 'later'

export interface DueInvoice {
  invoiceId: string
  studentId: string
  studentName: string
  invoiceNumber: string
  netParentCents: number
  amountPaidCents: number
  dueDate: string // YYYY-MM-DD
  status: string
}

export interface DueItem extends DueInvoice {
  outstandingCents: number
  bucket: DueBucket
}

export interface DueTotals {
  /** Due strictly before today and unpaid. */
  overdueCents: number
  /** Due exactly today. */
  todayCents: number
  /** Cumulative: due from today through the end of this week (incl. today). */
  weekCents: number
  /** Cumulative: due from today through the end of this month. */
  monthCents: number
  /** Cumulative: due from today through the end of this year. */
  yearCents: number
  /** Count of children with any outstanding invoice. */
  childrenCount: number
}

export interface DueOverview {
  items: DueItem[]
  totals: DueTotals
}

// Only issued/part-paid invoices represent money a parent owes.
const OWING_STATUSES = new Set(['issued', 'part_paid'])

function parse(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

/** End of the current week (Sunday) as YYYY-MM-DD, treating Monday as the first day. */
export function endOfWeekISO(todayISO: string): string {
  const t = new Date(parse(todayISO))
  const dow = t.getUTCDay() // 0=Sun..6=Sat
  const daysToSunday = (7 - dow) % 7
  t.setUTCDate(t.getUTCDate() + daysToSunday)
  return t.toISOString().slice(0, 10)
}

/** Last day of the current month as YYYY-MM-DD. */
export function endOfMonthISO(todayISO: string): string {
  const t = new Date(parse(todayISO))
  // Day 0 of next month = last day of this month.
  const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0))
  return end.toISOString().slice(0, 10)
}

/** 31 December of the current year as YYYY-MM-DD. */
export function endOfYearISO(todayISO: string): string {
  const t = new Date(parse(todayISO))
  return `${t.getUTCFullYear()}-12-31`
}

function classify(dueDate: string, todayISO: string): DueBucket {
  if (dueDate < todayISO) return 'overdue'
  if (dueDate === todayISO) return 'today'
  if (dueDate <= endOfWeekISO(todayISO)) return 'week'
  if (dueDate <= endOfMonthISO(todayISO)) return 'month'
  if (dueDate <= endOfYearISO(todayISO)) return 'year'
  return 'later'
}

/**
 * Build the due-by-period overview from outstanding invoices. Items are sorted by
 * due date (earliest first). Period totals are cumulative horizons from today, so
 * "this month" includes what is due this week and today.
 */
export function summariseDue(invoices: ReadonlyArray<DueInvoice>, todayISO: string): DueOverview {
  const items: DueItem[] = []
  const children = new Set<string>()

  for (const inv of invoices) {
    if (!OWING_STATUSES.has(inv.status)) continue
    const outstandingCents = Math.max(0, inv.netParentCents - inv.amountPaidCents)
    if (outstandingCents === 0) continue
    children.add(inv.studentId)
    items.push({ ...inv, outstandingCents, bucket: classify(inv.dueDate, todayISO) })
  }

  items.sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.studentName.localeCompare(b.studentName),
  )

  const sum = (fn: (i: DueItem) => boolean): number =>
    items.filter(fn).reduce((n, i) => n + i.outstandingCents, 0)

  const totals: DueTotals = {
    overdueCents: sum((i) => i.bucket === 'overdue'),
    todayCents: sum((i) => i.bucket === 'today'),
    // Cumulative from today onward (overdue excluded — it's shown separately).
    weekCents: sum((i) => i.bucket === 'today' || i.bucket === 'week'),
    monthCents: sum((i) => i.bucket === 'today' || i.bucket === 'week' || i.bucket === 'month'),
    yearCents: sum(
      (i) =>
        i.bucket === 'today' || i.bucket === 'week' || i.bucket === 'month' || i.bucket === 'year',
    ),
    childrenCount: children.size,
  }

  return { items, totals }
}
