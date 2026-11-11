import { describe, it, expect } from 'vitest'
import { buildFeeReceiptEmail, buildOverpaymentAlertEmail } from '../payment-emails'

describe('buildFeeReceiptEmail', () => {
  const base = {
    schoolName: 'Little Acorns',
    childName: 'Sam Byrne',
    subjectLabel: 'Invoice INV-2026-000001',
    amountCents: 25000,
    balanceCents: 0,
    paidAtISO: '2026-11-11T12:00:00Z',
    portalUrl: 'https://crechewise.com/parent/invoices',
  }

  it('confirms the amount, invoice and that nothing is left to pay', () => {
    const e = buildFeeReceiptEmail(base)
    expect(e.subject).toBe('Payment received: €250.00 for Sam Byrne')
    expect(e.text).toContain('Invoice INV-2026-000001')
    expect(e.text).toContain('Amount paid: €250.00')
    expect(e.text).toContain('Still to pay: Nothing, fully paid')
    expect(e.text).toContain('11 November 2026')
    expect(e.html).toContain('Little Acorns')
    expect(e.html).toContain('https://crechewise.com/parent/invoices')
  })

  it('shows the balance still owed after a part payment', () => {
    expect(buildFeeReceiptEmail({ ...base, balanceCents: 5000 }).text).toContain(
      'Still to pay: €50.00',
    )
  })

  it('escapes crèche- and child-controlled text in the HTML', () => {
    const e = buildFeeReceiptEmail({ ...base, childName: '<b>Sam</b>' })
    expect(e.html).not.toContain('<b>Sam</b>')
    expect(e.html).toContain('&lt;b&gt;Sam&lt;/b&gt;')
  })
})

describe('buildOverpaymentAlertEmail', () => {
  it('tells the crèche how much to refund and where', () => {
    const e = buildOverpaymentAlertEmail({
      schoolName: 'Little Acorns',
      childName: 'Sam Byrne',
      subjectLabel: 'Invoice INV-2026-000001',
      excessCents: 25000,
      provider: 'stripe',
      reference: 'cs_test_123',
      adminUrl: 'https://crechewise.com/admin/fees/abc',
    })
    expect(e.subject).toBe('Action needed: €250.00 overpaid for Sam Byrne')
    expect(e.text).toContain('Please refund €250.00')
    expect(e.text).toContain('Stripe dashboard')
    expect(e.text).toContain('cs_test_123')
    expect(e.html).toContain('https://crechewise.com/admin/fees/abc')
  })

  it('names Revolut Business for Revolut payments', () => {
    const e = buildOverpaymentAlertEmail({
      schoolName: 'Little Acorns',
      childName: 'Sam Byrne',
      subjectLabel: 'Late collection fee',
      excessCents: 1500,
      provider: 'revolut',
      reference: 'rev-1',
      adminUrl: 'https://crechewise.com/admin/fees/abc',
    })
    expect(e.text).toContain('Revolut Business dashboard')
  })
})
