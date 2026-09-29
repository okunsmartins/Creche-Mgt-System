// Arrears / outstanding-fees summary (FEE-10, partial). Pure + unit-tested.
// Outstanding = issued invoice balance not yet paid; overdue = balance past due date.

export interface ArrearsInvoice {
  studentId: string
  studentName: string
  netParentCents: number
  amountPaidCents: number
  dueDate: string // YYYY-MM-DD
  status: string
}

export interface ChildArrears {
  studentId: string
  studentName: string
  outstandingCents: number
  overdueCents: number
  invoiceCount: number
  /** Earliest due date with an outstanding balance (YYYY-MM-DD), or null. */
  oldestDueDate: string | null
}

export interface ArrearsSummary {
  totalOutstandingCents: number
  overdueCents: number
  childrenInArrears: number
  byChild: ChildArrears[]
}

// Only issued/part-paid invoices represent money a parent owes. draft = not billed
// yet; paid/void = nothing owed.
const OWING_STATUSES = new Set(['issued', 'part_paid'])

/**
 * Summarise outstanding balances per child from issued invoices. `todayISO` decides
 * what counts as overdue (due date strictly before today). Children are returned
 * sorted by outstanding balance, largest first.
 */
export function summariseArrears(
  invoices: ReadonlyArray<ArrearsInvoice>,
  todayISO: string,
): ArrearsSummary {
  const byChildMap = new Map<string, ChildArrears>()

  for (const inv of invoices) {
    if (!OWING_STATUSES.has(inv.status)) continue
    const outstanding = Math.max(0, inv.netParentCents - inv.amountPaidCents)
    if (outstanding === 0) continue
    const overdue = inv.dueDate < todayISO ? outstanding : 0

    const entry =
      byChildMap.get(inv.studentId) ??
      ({
        studentId: inv.studentId,
        studentName: inv.studentName,
        outstandingCents: 0,
        overdueCents: 0,
        invoiceCount: 0,
        oldestDueDate: null,
      } satisfies ChildArrears)

    entry.outstandingCents += outstanding
    entry.overdueCents += overdue
    entry.invoiceCount += 1
    if (entry.oldestDueDate === null || inv.dueDate < entry.oldestDueDate) {
      entry.oldestDueDate = inv.dueDate
    }
    byChildMap.set(inv.studentId, entry)
  }

  const byChild = [...byChildMap.values()].sort((a, b) => b.outstandingCents - a.outstandingCents)
  return {
    totalOutstandingCents: byChild.reduce((s, c) => s + c.outstandingCents, 0),
    overdueCents: byChild.reduce((s, c) => s + c.overdueCents, 0),
    childrenInArrears: byChild.length,
    byChild,
  }
}
