// Revolut webhook: which crèche does an event belong to? The dated API drops
// merchant_order_ext_ref, so when the reference can't name the crèche, the one whose
// own signing secret verifies the body is used, and the order is re-fetched with
// THAT crèche's key. Unsigned / wrongly-signed events are rejected.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/email/send', () => ({ sendOrderEmails: vi.fn(), sendDepositEmail: vi.fn() }))
vi.mock('@/lib/fees/record-payment', () => ({ recordFeePayment: vi.fn() }))

const SECRETS: Record<string, string> = { school_a: 'wsk_a', school_b: 'wsk_b' }
const KEYS: Record<string, string> = { school_a: 'r_test_a', school_b: 'r_test_b' }
let refSchool: string | null = null
vi.mock('@/lib/revolut/perSchool', () => ({
  schoolIdFromExtRef: vi.fn(async (ref?: string) => (ref ? refSchool : null)),
  resolveRevolutWebhookSecret: vi.fn(async (id: string | null) => (id ? SECRETS[id] : '')),
  resolveRevolutApiKey: vi.fn(async (id: string | null) => (id ? KEYS[id] : '')),
  schoolIdFromWebhookSignature: vi.fn(async (verify: (s: string) => boolean) => {
    let checked = 0
    for (const [id, s] of Object.entries(SECRETS)) {
      checked++
      if (verify(s)) return { schoolId: id, secretsChecked: checked }
    }
    return { schoolId: null, secretsChecked: checked }
  }),
}))

const revolutGet = vi.fn()
vi.mock('@/lib/revolut/client', () => ({ revolutGet: (...a: unknown[]) => revolutGet(...a) }))

const inserted: unknown[] = []
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      insert: async (row: unknown) => {
        inserted.push(row)
        return { error: null }
      },
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}))

import { POST } from '../route'

function request(body: string, secret: string | null) {
  const ts = String(Date.now())
  const sig = secret
    ? 'v1=' + createHmac('sha256', secret).update(`v1.${ts}.${body}`).digest('hex')
    : null
  const headers = new Headers()
  if (sig) headers.set('revolut-signature', sig)
  headers.set('revolut-request-timestamp', ts)
  return new Request('https://crechewise.com/api/webhooks/revolut', {
    method: 'POST',
    body,
    headers,
  }) as unknown as NextRequest
}

const completed = JSON.stringify({ event: 'ORDER_COMPLETED', order_id: 'ord_1' })

describe('Revolut webhook: finding the crèche', () => {
  beforeEach(() => {
    refSchool = null
    inserted.length = 0
    revolutGet.mockReset()
    // Not completed yet → handler stops after the authoritative re-fetch.
    revolutGet.mockResolvedValue({ id: 'ord_1', state: 'pending' })
  })

  it('no reference in the event: the crèche whose secret signed it is used', async () => {
    const res = await POST(request(completed, 'wsk_b'))
    expect(res.status).toBe(200)
    expect(revolutGet).toHaveBeenCalledWith('/orders/ord_1', 'r_test_b')
    expect(inserted).toHaveLength(1)
  })

  it('reference names the crèche: its secret is used directly', async () => {
    refSchool = 'school_a'
    const body = JSON.stringify({
      event: 'ORDER_COMPLETED',
      order_id: 'ord_1',
      merchant_order_ext_ref: 'INVPAY_x',
    })
    const res = await POST(request(body, 'wsk_a'))
    expect(res.status).toBe(200)
    expect(revolutGet).toHaveBeenCalledWith('/orders/ord_1', 'r_test_a')
  })

  it('a wrong reference cannot redirect the event: the signature decides', async () => {
    refSchool = 'school_a' // reference claims crèche A…
    const body = JSON.stringify({
      event: 'ORDER_COMPLETED',
      order_id: 'ord_1',
      merchant_order_ext_ref: 'INVPAY_x',
    })
    const res = await POST(request(body, 'wsk_b')) // …but B signed it
    expect(res.status).toBe(200)
    expect(revolutGet).toHaveBeenCalledWith('/orders/ord_1', 'r_test_b')
  })

  it('forged or missing signatures are rejected and nothing is recorded', async () => {
    expect((await POST(request(completed, 'attacker'))).status).toBe(400)
    expect((await POST(request(completed, null))).status).toBe(400)
    expect(revolutGet).not.toHaveBeenCalled()
    expect(inserted).toHaveLength(0)
  })
})

describe('Revolut webhook: refund orders are not payments', () => {
  beforeEach(async () => {
    refSchool = null
    inserted.length = 0
    revolutGet.mockReset()
    const { recordFeePayment } = await import('@/lib/fees/record-payment')
    vi.mocked(recordFeePayment).mockClear()
  })

  // A refund is its own Revolut order (type "refund") with its own ORDER_COMPLETED.
  // Even if it carried the original order's metadata, it must never be recorded as
  // money coming in (that would mark the refunded invoice paid a second time).
  it('ORDER_COMPLETED for a refund order records nothing', async () => {
    revolutGet.mockResolvedValue({
      id: 'ref_1',
      type: 'refund',
      state: 'completed',
      amount: 100,
      currency: 'EUR',
      metadata: { kind: 'invoice', invoice_id: 'inv_1', school_id: 'school_b' },
    })
    const body = JSON.stringify({ event: 'ORDER_COMPLETED', order_id: 'ref_1' })
    const res = await POST(request(body, 'wsk_b'))
    expect(res.status).toBe(200)
    const { recordFeePayment } = await import('@/lib/fees/record-payment')
    expect(recordFeePayment).not.toHaveBeenCalled()
    // Only the webhook_events row (dedupe), no payment.
    expect(inserted).toHaveLength(1)
  })

  it('a failed refund order is reported, not treated as a failed payment', async () => {
    revolutGet.mockResolvedValue({ id: 'ref_2', type: 'refund', state: 'failed' })
    const body = JSON.stringify({ event: 'ORDER_FAILED', order_id: 'ref_2' })
    expect((await POST(request(body, 'wsk_b'))).status).toBe(200)
    const { logger } = await import('@/lib/logging')
    expect(logger.error).toHaveBeenCalledWith(
      'revolut_non_payment_order_failed',
      expect.objectContaining({ revolutOrderId: 'ref_2', type: 'refund' }),
    )
  })

  it('a completed PAYMENT order for an invoice is still recorded', async () => {
    revolutGet.mockResolvedValue({
      id: 'ord_9',
      type: 'payment',
      state: 'completed',
      amount: 100,
      currency: 'EUR',
      metadata: { kind: 'invoice', invoice_id: 'inv_1', school_id: 'school_b' },
    })
    const body = JSON.stringify({ event: 'ORDER_COMPLETED', order_id: 'ord_9' })
    expect((await POST(request(body, 'wsk_b'))).status).toBe(200)
    const { recordFeePayment } = await import('@/lib/fees/record-payment')
    expect(recordFeePayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'invoice', subjectId: 'inv_1', amountCents: 100 }),
    )
  })
})
