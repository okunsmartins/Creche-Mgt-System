import { describe, it, expect } from 'vitest'
import { dedupeByRefundId, refundsToAuditFromWebhook, type ProviderRefund } from '../refund-audit'

const appRefund: ProviderRefund = {
  id: 're_app',
  amount: 50,
  status: 'succeeded',
  metadata: { fee_payment_id: 'p1', requested_by: 'admin1' },
}
const dashRefund: ProviderRefund = { id: 're_dash', amount: 100, status: 'succeeded', metadata: {} }

describe('refundsToAuditFromWebhook', () => {
  it('skips refunds the app made (the admin action audits those), even if the webhook is first', () => {
    expect(refundsToAuditFromWebhook([appRefund, dashRefund], new Set())).toEqual([dashRefund])
  })
  it('skips refunds already audited (webhook retry / second event for the same charge)', () => {
    expect(refundsToAuditFromWebhook([dashRefund], new Set(['re_dash']))).toEqual([])
  })
  it('skips failed or cancelled refunds', () => {
    const failed = { ...dashRefund, id: 're_f', status: 'failed' }
    const canceled = { ...dashRefund, id: 're_c', status: 'canceled' }
    expect(refundsToAuditFromWebhook([failed, canceled], new Set())).toEqual([])
  })
})

describe('dedupeByRefundId', () => {
  it('keeps one row per refund id and every row without an id', () => {
    const rows = [
      { k: 1, id: 're_1' },
      { k: 2, id: 're_1' },
      { k: 3, id: null },
      { k: 4, id: null },
      { k: 5, id: 're_2' },
    ]
    expect(dedupeByRefundId(rows, (r) => r.id).map((r) => r.k)).toEqual([1, 3, 4, 5])
  })
})
