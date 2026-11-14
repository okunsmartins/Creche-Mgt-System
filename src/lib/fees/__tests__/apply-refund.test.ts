// applyFeeRefund against the same in-memory Supabase fake as record-payment.test.ts:
// refunds settle the invoice / late fee from the net received and are retry-safe.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email/client', () => ({ getResend: () => ({ emails: { send: vi.fn() } }) }))
vi.mock('@/lib/email/from', () => ({ buildEmailFrom: (n: string) => n }))
vi.mock('@/lib/env', () => ({ serverEnv: { appUrl: 'https://app.test' } }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdminClient: vi.fn() }))

import { applyFeeRefund, feeSubjectForPayment, type FeePaymentRecord } from '../apply-refund'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

/** Minimal fake of the supabase-js builder: insert / select / update with eq / in filters. */
function fakeDb(tables: Tables) {
  const uniqueKeys: Record<string, (r: Row) => string | null> = {
    payments: (r) =>
      r.provider_order_id
        ? `order:${String(r.provider_order_id)}`
        : r.provider_checkout_session_id
          ? `sess:${String(r.invoice_id ?? r.late_collection_id)}:${String(r.provider_checkout_session_id)}`
          : null,
  }
  return {
    from(table: string) {
      const rows = (tables[table] ??= [])
      const filters: ((r: Row) => boolean)[] = []
      let op: 'select' | 'update' = 'select'
      let patch: Row = {}
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
        update: (p: Row) => ((op = 'update'), (patch = p), q),
        insert: async (r: Row) => {
          const key = uniqueKeys[table]?.(r)
          if (key && rows.some((x) => uniqueKeys[table]!(x) === key))
            return { error: { code: '23505', message: 'duplicate' } }
          rows.push({ ...r })
          return { error: null }
        },
        single: async () => {
          const hit = rows.filter((r) => filters.every((f) => f(r)))[0]
          return hit ? { data: hit, error: null } : { data: null, error: { message: 'none' } }
        },
        maybeSingle: async () => ({
          data: rows.filter((r) => filters.every((f) => f(r)))[0] ?? null,
          error: null,
        }),
        then: (resolve: (v: unknown) => void) => {
          const hits = rows.filter((r) => filters.every((f) => f(r)))
          if (op === 'update') hits.forEach((r) => Object.assign(r, patch))
          resolve({ data: hits, error: null })
        },
      }
      return q
    },
  }
}

function tables(): Tables {
  return {
    invoices: [
      {
        id: 'inv1',
        school_id: 's1',
        student_id: 'c1',
        invoice_number: 'INV-1',
        net_parent_cents: 1000,
        amount_paid_cents: 1000,
        status: 'paid',
      },
    ],
    late_collections: [
      {
        id: 'lc1',
        school_id: 's1',
        student_id: 'c1',
        fee_cents: 100,
        amount_paid_cents: 100,
        paid_at: '2026-11-14',
      },
    ],
    payments: [
      {
        id: 'p1',
        invoice_id: 'inv1',
        late_collection_id: null,
        amount_cents: 1000,
        refunded_amount_cents: 0,
        status: 'paid',
      },
      {
        id: 'p2',
        invoice_id: null,
        late_collection_id: 'lc1',
        amount_cents: 100,
        refunded_amount_cents: 0,
        status: 'paid',
      },
    ],
  }
}

async function refund(t: Tables, paymentId: string, total: number) {
  const db = fakeDb(t) as never
  const p = t.payments!.find((r) => r.id === paymentId) as unknown as FeePaymentRecord
  const subject = (await feeSubjectForPayment(db, p))!
  return applyFeeRefund(db, { ...p }, subject, total)
}

describe('applyFeeRefund', () => {
  it('part refund: payment part refunded, invoice part paid', async () => {
    const t = tables()
    expect(await refund(t, 'p1', 400)).toEqual({ newlyRefundedCents: 400 })
    expect(t.payments![0]).toMatchObject({
      refunded_amount_cents: 400,
      status: 'partially_refunded',
    })
    expect(t.invoices![0]).toMatchObject({ amount_paid_cents: 600, status: 'part_paid' })
  })

  it('full refund puts the invoice back to issued, and a repeat changes nothing', async () => {
    const t = tables()
    await refund(t, 'p1', 1000)
    expect(t.payments![0]).toMatchObject({ refunded_amount_cents: 1000, status: 'refunded' })
    expect(t.invoices![0]).toMatchObject({ amount_paid_cents: 0, status: 'issued' })
    // Webhook retry / admin+webhook race: same cumulative total again.
    expect(await refund(t, 'p1', 1000)).toEqual({ newlyRefundedCents: 0 })
    expect(t.payments![0]).toMatchObject({ refunded_amount_cents: 1000 })
  })

  it('never refunds more than was paid, and never goes backwards', async () => {
    const t = tables()
    await refund(t, 'p1', 600)
    expect(await refund(t, 'p1', 300)).toEqual({ newlyRefundedCents: 0 })
    expect(await refund(t, 'p1', 5000)).toEqual({ newlyRefundedCents: 400 })
    expect(t.payments![0]).toMatchObject({ refunded_amount_cents: 1000 })
  })

  it('late fee: full refund clears paid_at', async () => {
    const t = tables()
    await refund(t, 'p2', 100)
    expect(t.late_collections![0]).toMatchObject({ amount_paid_cents: 0, paid_at: null })
  })

  it('order payments have no fee subject', async () => {
    const db = fakeDb(tables()) as never
    expect(
      await feeSubjectForPayment(db, { invoice_id: null, late_collection_id: null }),
    ).toBeNull()
  })
})
