// Provider (Pobal) receivables report — the state's side of the subvention (spec §7.7
// Hive-prep / reconciliation, and the accrual view of FEE-11). Pure + unit-tested.
//
// Every issued invoice snapshots what the PROVIDER can claim from Pobal: ECCE
// capitation and NCS subsidy. This aggregates those so a manager can reconcile against
// what Pobal actually pays. Parent payment is irrelevant here — the state pays the
// provider regardless — so draft/void are excluded but paid/part-paid/issued all count.

export interface ReceivableInvoice {
  studentId: string
  studentName: string
  providerReceivableEcceCents: number
  providerReceivableNcsCents: number
  status: string
}

export interface ChildReceivable {
  studentId: string
  studentName: string
  ecceCents: number
  ncsCents: number
  totalCents: number
  invoiceCount: number
}

export interface ReceivablesSummary {
  totalEcceCents: number
  totalNcsCents: number
  totalCents: number
  byChild: ChildReceivable[]
}

// Receivables accrue once an invoice is issued; drafts aren't real yet, voids are cancelled.
const ACCRUING = new Set(['issued', 'part_paid', 'paid'])

/** Aggregate provider receivables per child from issued invoices, largest total first. */
export function summariseProviderReceivables(
  invoices: ReadonlyArray<ReceivableInvoice>,
): ReceivablesSummary {
  const byChildMap = new Map<string, ChildReceivable>()
  for (const inv of invoices) {
    if (!ACCRUING.has(inv.status)) continue
    const ecce = Math.max(0, inv.providerReceivableEcceCents)
    const ncs = Math.max(0, inv.providerReceivableNcsCents)
    if (ecce === 0 && ncs === 0) continue

    const entry =
      byChildMap.get(inv.studentId) ??
      ({
        studentId: inv.studentId,
        studentName: inv.studentName,
        ecceCents: 0,
        ncsCents: 0,
        totalCents: 0,
        invoiceCount: 0,
      } satisfies ChildReceivable)
    entry.ecceCents += ecce
    entry.ncsCents += ncs
    entry.totalCents += ecce + ncs
    entry.invoiceCount += 1
    byChildMap.set(inv.studentId, entry)
  }

  const byChild = [...byChildMap.values()].sort((a, b) => b.totalCents - a.totalCents)
  return {
    totalEcceCents: byChild.reduce((s, c) => s + c.ecceCents, 0),
    totalNcsCents: byChild.reduce((s, c) => s + c.ncsCents, 0),
    totalCents: byChild.reduce((s, c) => s + c.totalCents, 0),
    byChild,
  }
}
