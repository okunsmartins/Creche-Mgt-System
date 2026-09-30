import { describe, it, expect } from 'vitest'
import { summariseFeeYear, type ProjectionInvoice } from '../projection'

const dueDates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']
const today = '2026-02-15'

describe('summariseFeeYear', () => {
  it('counts invoiced vs projected periods and sums money', () => {
    const invoices: ProjectionInvoice[] = [
      { dueDate: '2026-01-01', netParentCents: 10000, amountPaidCents: 10000, status: 'paid' },
      { dueDate: '2026-02-01', netParentCents: 10000, amountPaidCents: 4000, status: 'part_paid' },
    ]
    const p = summariseFeeYear({ dueDates, invoices, todayISO: today })
    expect(p.totalPeriods).toBe(4)
    expect(p.invoicedPeriods).toBe(2)
    expect(p.projectedPeriods).toBe(2)
    expect(p.invoicedCents).toBe(20000)
    expect(p.paidCents).toBe(14000)
    expect(p.outstandingCents).toBe(6000) // only the part_paid balance
  })

  it('next due = earliest still-owing invoice', () => {
    const invoices: ProjectionInvoice[] = [
      { dueDate: '2026-01-01', netParentCents: 10000, amountPaidCents: 10000, status: 'paid' },
      { dueDate: '2026-02-01', netParentCents: 10000, amountPaidCents: 0, status: 'issued' },
    ]
    expect(summariseFeeYear({ dueDates, invoices, todayISO: today }).nextDueDate).toBe('2026-02-01')
  })

  it('next due falls back to first uninvoiced scheduled date >= today', () => {
    const invoices: ProjectionInvoice[] = [
      { dueDate: '2026-01-01', netParentCents: 10000, amountPaidCents: 10000, status: 'paid' },
    ]
    // Jan invoiced+paid; next scheduled uninvoiced >= 2026-02-15 is 2026-03-01.
    expect(summariseFeeYear({ dueDates, invoices, todayISO: today }).nextDueDate).toBe('2026-03-01')
  })

  it('ignores void invoices', () => {
    const invoices: ProjectionInvoice[] = [
      { dueDate: '2026-01-01', netParentCents: 10000, amountPaidCents: 0, status: 'void' },
    ]
    const p = summariseFeeYear({ dueDates, invoices, todayISO: today })
    expect(p.invoicedPeriods).toBe(0)
    expect(p.invoicedCents).toBe(0)
    expect(p.outstandingCents).toBe(0)
  })
})
