import { describe, it, expect } from 'vitest'
import { summariseParentInvoices } from '../parent-summary'

const inv = (status: string, net: number, paid = 0) => ({
  status,
  net_parent_cents: net,
  amount_paid_cents: paid,
})

describe('summariseParentInvoices', () => {
  it('no invoices', () => {
    expect(summariseParentInvoices([])).toEqual({
      outstandingCents: 0,
      unpaidCount: 0,
      invoiceCount: 0,
    })
  })

  it('one €1 issued invoice → €1 due, 1 unpaid', () => {
    expect(summariseParentInvoices([inv('issued', 100)])).toEqual({
      outstandingCents: 100,
      unpaidCount: 1,
      invoiceCount: 1,
    })
  })

  it('counts only what is left on part-paid invoices, and skips paid ones', () => {
    expect(
      summariseParentInvoices([
        inv('paid', 20000, 20000),
        inv('part_paid', 20000, 5000),
        inv('issued', 100),
      ]),
    ).toEqual({ outstandingCents: 15100, unpaidCount: 2, invoiceCount: 3 })
  })

  it('never goes negative on an overpaid invoice', () => {
    expect(summariseParentInvoices([inv('issued', 100, 300)])).toEqual({
      outstandingCents: 0,
      unpaidCount: 0,
      invoiceCount: 1,
    })
  })

  it('a zero-amount invoice (fully funded) is not "unpaid"', () => {
    expect(summariseParentInvoices([inv('issued', 0)]).unpaidCount).toBe(0)
  })
})
