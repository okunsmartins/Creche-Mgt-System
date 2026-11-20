import { describe, it, expect } from 'vitest'
import { buildFeeRefundRows, type FeeRefundAudit, type FeeRefundPayment } from '../refund-list'

const audits: FeeRefundAudit[] = [
  {
    id: 'a1',
    created_at: '2026-11-15T13:12:48Z',
    actor_email: 'manager@creche.test',
    resource_id: 'p1',
    metadata: {
      amount_cents: 50,
      subject: 'Invoice INV-1',
      reason: 'Part refund',
      provider_refund_id: 're_1',
    },
  },
  {
    id: 'a2',
    created_at: '2026-11-15T02:29:13Z',
    actor_email: 'stripe-webhook',
    resource_id: 'p2',
    metadata: { amount_cents: 100, subject: 'Late collection fee', charge_id: 'ch_2' },
  },
  // Payment of another crèche's invoice: must not appear.
  {
    id: 'a3',
    created_at: '2026-11-15T01:00:00Z',
    actor_email: 'x@other.test',
    resource_id: 'p3',
    metadata: { amount_cents: 999 },
  },
  // Payment row gone: dropped.
  {
    id: 'a4',
    created_at: '2026-11-15T00:00:00Z',
    actor_email: null,
    resource_id: 'p9',
    metadata: null,
  },
]
const payments: FeePaymentRows = [
  { id: 'p1', payment_reference: 'PAY-1', invoice_id: 'inv1', late_collection_id: null },
  { id: 'p2', payment_reference: 'PAY-2', invoice_id: null, late_collection_id: 'lc1' },
  { id: 'p3', payment_reference: 'PAY-3', invoice_id: 'invOther', late_collection_id: null },
]
type FeePaymentRows = FeeRefundPayment[]

describe('buildFeeRefundRows', () => {
  const rows = buildFeeRefundRows(
    audits,
    payments,
    new Map([
      ['inv1', 'c1'],
      ['lc1', 'c1'],
    ]),
    new Map([['c1', 'Sam Test']]),
  )

  it('keeps only refunds whose payment belongs to this crèche', () => {
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2'])
  })

  it('maps admin and Stripe-dashboard refunds into display rows', () => {
    expect(rows[0]).toEqual({
      id: 'a1',
      createdAt: '2026-11-15T13:12:48Z',
      amountCents: 50,
      subjectLabel: 'Invoice INV-1',
      childName: 'Sam Test',
      studentId: 'c1',
      initiatedBy: 'manager@creche.test',
      reason: 'Part refund',
      providerRefundId: 're_1',
      paymentReference: 'PAY-1',
    })
    expect(rows[1]).toMatchObject({
      subjectLabel: 'Late collection fee',
      initiatedBy: 'Stripe dashboard',
      providerRefundId: 'ch_2',
      reason: null,
      amountCents: 100,
    })
  })
})

describe('buildFeeRefundRows: one row per real refund', () => {
  it('a double-submit audited twice under the same Stripe refund id shows once', () => {
    const dup: FeeRefundAudit[] = [
      { ...audits[0]!, id: 'a1' },
      { ...audits[0]!, id: 'a1-again' },
    ]
    const rows = buildFeeRefundRows(dup, payments, new Map([['inv1', 'c1']]), new Map())
    expect(rows.map((r) => r.id)).toEqual(['a1'])
  })
})
