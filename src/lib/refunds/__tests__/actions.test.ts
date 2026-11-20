// initiateRefundAction against an in-memory Supabase fake. Regression for the review of
// 2026-11-20: a double-submit sends the same Stripe idempotency key, so Stripe returns
// the SAME refund; it must be recorded once, not twice.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ORDER = '11111111-1111-4111-8111-111111111111'
const PAYMENT = '22222222-2222-4222-8222-222222222222'

const refundsCreate = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: async () => ({ id: 'admin1', schoolId: 's1', email: 'a@creche.test' }),
}))
vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({ refunds: { create: refundsCreate } }),
}))
vi.mock('@/lib/stripe/connect', () => ({
  getSchoolConnect: async () => ({ stripe_connect_account_id: 'acct_1' }),
}))
vi.mock('@/lib/revolut/client', () => ({ revolutPost: vi.fn() }))
vi.mock('@/lib/revolut/perSchool', () => ({ resolveRevolutApiKey: vi.fn() }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

type Row = Record<string, unknown>
let tables: Record<string, Row[]>
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const rows = (tables[table] ??= [])
      const filters: ((r: Row) => boolean)[] = []
      let op: 'select' | 'update' = 'select'
      let patch: Row = {}
      const q = {
        select: () => q,
        limit: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
        update: (p: Row) => ((op = 'update'), (patch = p), q),
        insert: async (r: Row) => (rows.push({ ...r }), { error: null }),
        single: async () => {
          const hit = rows.find((r) => filters.every((f) => f(r)))
          return hit ? { data: hit, error: null } : { data: null, error: { message: 'none' } }
        },
        then: (resolve: (v: unknown) => void) => {
          const hits = rows.filter((r) => filters.every((f) => f(r)))
          if (op === 'update') hits.forEach((r) => Object.assign(r, patch))
          resolve({ data: hits, error: null })
        },
      }
      return q
    },
  }),
}))

import { initiateRefundAction } from '../actions'

function form(amount: string) {
  const fd = new FormData()
  fd.set('orderId', ORDER)
  fd.set('paymentId', PAYMENT)
  fd.set('amountEuros', amount)
  fd.set('reason', 'Charged twice')
  return fd
}

describe('initiateRefundAction', () => {
  beforeEach(() => {
    refundsCreate.mockReset()
    tables = {
      orders: [{ id: ORDER, school_id: 's1', status: 'paid' }],
      payments: [
        {
          id: PAYMENT,
          order_id: ORDER,
          amount_cents: 1000,
          provider: 'stripe',
          provider_payment_intent_id: 'pi_1',
          provider_order_id: null,
          status: 'paid',
        },
      ],
      refunds: [],
      audit_logs: [],
    }
  })

  it('a double-submit (same Stripe refund returned) is recorded once', async () => {
    // Stripe returns the same refund for a replayed idempotency key.
    refundsCreate.mockResolvedValue({ id: 're_same', status: 'succeeded' })

    expect(await initiateRefundAction(null as never, form('5.00'))).toMatchObject({
      success: true,
    })
    expect(await initiateRefundAction(null as never, form('5.00'))).toMatchObject({
      success: true,
    })

    expect(tables.refunds!.filter((r) => r.provider_refund_id === 're_same')).toHaveLength(1)
    expect(tables.audit_logs!.filter((r) => r.action === 'refund.requested')).toHaveLength(1)
  })

  it('sends an idempotency key tied to the payment, prior refunds and amount', async () => {
    refundsCreate.mockResolvedValue({ id: 're_1', status: 'succeeded' })
    await initiateRefundAction(null as never, form('5.00'))
    expect(refundsCreate.mock.calls[0]![1]).toMatchObject({
      stripeAccount: 'acct_1',
      idempotencyKey: `order-refund:${PAYMENT}:0:500`,
    })
  })

  it('two genuinely separate part refunds are both recorded', async () => {
    refundsCreate
      .mockResolvedValueOnce({ id: 're_a', status: 'succeeded' })
      .mockResolvedValueOnce({ id: 're_b', status: 'succeeded' })
    await initiateRefundAction(null as never, form('3.00'))
    await initiateRefundAction(null as never, form('3.00'))
    expect(tables.refunds!.map((r) => r.provider_refund_id)).toEqual(['re_a', 're_b'])
    // The second key reflects the first refund, so Stripe treats it as a new request.
    expect(refundsCreate.mock.calls[1]![1]).toMatchObject({
      idempotencyKey: `order-refund:${PAYMENT}:300:300`,
    })
  })
})
