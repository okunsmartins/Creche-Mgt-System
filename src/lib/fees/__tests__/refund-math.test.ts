import { describe, it, expect } from 'vitest'
import {
  invoiceAfterRefund,
  lateFeeAfterRefund,
  netReceivedCents,
  paymentStatusAfterRefund,
  refundableCents,
} from '../refund-math'
import { buildFeeReceiptEmail, buildFeeRefundEmail } from '../payment-emails'

describe('refundableCents / paymentStatusAfterRefund', () => {
  it('computes what is left to refund', () => {
    expect(refundableCents(1000, 0)).toBe(1000)
    expect(refundableCents(1000, 400)).toBe(600)
    expect(refundableCents(1000, 1000)).toBe(0)
  })
  it('moves a payment through paid → part refunded → refunded', () => {
    expect(paymentStatusAfterRefund(1000, 0)).toBe('paid')
    expect(paymentStatusAfterRefund(1000, 1)).toBe('partially_refunded')
    expect(paymentStatusAfterRefund(1000, 1000)).toBe('refunded')
  })
})

describe('netReceivedCents', () => {
  it('sums payments net of refunds', () => {
    expect(
      netReceivedCents([
        { amount_cents: 1000, refunded_amount_cents: 0 },
        { amount_cents: 500, refunded_amount_cents: 200 },
        { amount_cents: 300, refunded_amount_cents: 300 },
        { amount_cents: 100, refunded_amount_cents: null },
      ]),
    ).toBe(1400)
  })
})

describe('invoiceAfterRefund', () => {
  it('full refund puts a paid invoice back to issued with nothing paid', () => {
    expect(invoiceAfterRefund({ netParentCents: 100, status: 'paid' }, 0)).toEqual({
      amountPaidCents: 0,
      status: 'issued',
    })
  })
  it('part refund leaves it part paid', () => {
    expect(invoiceAfterRefund({ netParentCents: 1000, status: 'paid' }, 600)).toEqual({
      amountPaidCents: 600,
      status: 'part_paid',
    })
  })
  it('stays paid when other payments still cover it, and caps at the amount owed', () => {
    expect(invoiceAfterRefund({ netParentCents: 1000, status: 'paid' }, 1300)).toEqual({
      amountPaidCents: 1000,
      status: 'paid',
    })
  })
  it('leaves void and draft invoices alone', () => {
    expect(invoiceAfterRefund({ netParentCents: 1000, status: 'void' }, 0)).toBeNull()
    expect(invoiceAfterRefund({ netParentCents: 1000, status: 'draft' }, 0)).toBeNull()
  })
})

describe('lateFeeAfterRefund', () => {
  it('un-pays a fully refunded late fee', () => {
    expect(lateFeeAfterRefund(100, 0)).toEqual({ amountPaidCents: 0, fullyPaid: false })
  })
  it('keeps it paid when still covered', () => {
    expect(lateFeeAfterRefund(100, 100)).toEqual({ amountPaidCents: 100, fullyPaid: true })
  })
})

describe('fee emails', () => {
  const base = {
    schoolName: 'Test Crèche',
    childName: 'Sam Test',
    subjectLabel: 'Late collection fee',
    amountCents: 100,
  }
  it('receipt button matches the page it links to', () => {
    const late = buildFeeReceiptEmail({
      ...base,
      balanceCents: 0,
      paidAtISO: '2026-11-14T02:00:00Z',
      portalUrl: 'https://x.test/parent/late-fees',
    })
    expect(late.html).toContain('View your late fees')
    expect(late.text).toContain('View your late fees: https://x.test/parent/late-fees')
    const inv = buildFeeReceiptEmail({
      ...base,
      subjectLabel: 'Invoice INV-1',
      balanceCents: 0,
      paidAtISO: '2026-11-14T02:00:00Z',
      portalUrl: 'https://x.test/parent/invoices',
    })
    expect(inv.html).toContain('View your invoices')
  })
  it('refund email states the amount and what it was for', () => {
    const m = buildFeeRefundEmail({
      ...base,
      refundedAtISO: '2026-11-14T02:00:00Z',
      portalUrl: 'https://x.test/parent/late-fees',
    })
    expect(m.subject).toBe('Refund: €1.00 for Sam Test')
    expect(m.text).toContain('Amount refunded: €1.00')
    expect(m.text).toContain('For: Late collection fee')
    expect(m.html).toContain('View your late fees')
  })
})
