import { describe, it, expect } from 'vitest'
import { settleInvoice, settleLateFee } from '../settle-payment'

const inv = (status: string, net = 10000, paid = 0) => ({
  netParentCents: net,
  amountPaidCents: paid,
  status,
})

describe('settleInvoice', () => {
  it('marks an issued invoice paid when the full amount arrives', () => {
    expect(settleInvoice(inv('issued'), 10000)).toEqual({
      amountPaidCents: 10000,
      status: 'paid',
      excessCents: 0,
      changed: true,
    })
  })

  it('marks it part-paid when less arrives', () => {
    expect(settleInvoice(inv('issued'), 4000)).toMatchObject({
      amountPaidCents: 4000,
      status: 'part_paid',
      excessCents: 0,
    })
  })

  it('completes a part-paid invoice from the running total', () => {
    expect(settleInvoice(inv('part_paid', 10000, 4000), 10000)).toMatchObject({
      amountPaidCents: 10000,
      status: 'paid',
      excessCents: 0,
      changed: true,
    })
  })

  it('caps the paid amount at what was owed and reports the rest as excess', () => {
    expect(settleInvoice(inv('issued'), 15000)).toEqual({
      amountPaidCents: 10000,
      status: 'paid',
      excessCents: 5000,
      changed: true,
    })
  })

  it('a second payment on an already-paid invoice is all excess and changes nothing', () => {
    expect(settleInvoice(inv('paid', 10000, 10000), 20000)).toEqual({
      amountPaidCents: 10000,
      status: 'paid',
      excessCents: 10000,
      changed: false,
    })
  })

  it('a webhook retry (same total) on a paid invoice is a no-op with no excess', () => {
    expect(settleInvoice(inv('paid', 10000, 10000), 10000)).toEqual({
      amountPaidCents: 10000,
      status: 'paid',
      excessCents: 0,
      changed: false,
    })
  })

  it('treats everything paid on a void or draft invoice as excess and never changes it', () => {
    for (const status of ['void', 'draft']) {
      expect(settleInvoice(inv(status, 10000, 0), 10000)).toEqual({
        amountPaidCents: 0,
        status,
        excessCents: 10000,
        changed: false,
      })
    }
  })

  it('never lowers an amount already recorded (legacy rows without payment rows)', () => {
    expect(settleInvoice(inv('part_paid', 10000, 6000), 3000)).toMatchObject({
      amountPaidCents: 6000,
      status: 'part_paid',
      changed: false,
    })
  })
})

describe('settleLateFee', () => {
  it('marks the fee fully paid', () => {
    expect(settleLateFee({ feeCents: 1500, amountPaidCents: 0 }, 1500)).toEqual({
      amountPaidCents: 1500,
      fullyPaid: true,
      excessCents: 0,
      changed: true,
    })
  })

  it('reports a second payment as excess without inflating the paid amount', () => {
    expect(settleLateFee({ feeCents: 1500, amountPaidCents: 1500 }, 3000)).toEqual({
      amountPaidCents: 1500,
      fullyPaid: true,
      excessCents: 1500,
      changed: false,
    })
  })

  it('a retry with the same total is a no-op', () => {
    expect(settleLateFee({ feeCents: 1500, amountPaidCents: 1500 }, 1500)).toMatchObject({
      excessCents: 0,
      changed: false,
    })
  })
})
