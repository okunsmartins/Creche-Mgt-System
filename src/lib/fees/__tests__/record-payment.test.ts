// Webhook payment flow (shared by the Stripe + Revolut routes) against a small
// in-memory fake of the Supabase query builder. Covers: settle on payment, retry
// idempotency, overpayment detection + crèche alert, void invoices, late fees,
// and that email failures never fail the webhook.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sent: { to: string; subject: string }[] = []
let sendFails = false

vi.mock('@/lib/email/client', () => ({
  getResend: () => ({
    emails: {
      send: async (m: { to: string; subject: string }) => {
        if (sendFails) return { data: null, error: { message: 'boom' } }
        sent.push({ to: m.to, subject: m.subject })
        return { data: { id: 'msg' }, error: null }
      },
    },
  }),
}))
vi.mock('@/lib/email/from', () => ({ buildEmailFrom: (n: string) => `${n} <noreply@x.test>` }))
vi.mock('@/lib/email/send', () => ({ resolveSchoolAdminEmail: async () => 'owner@creche.test' }))
vi.mock('@/lib/env', () => ({ serverEnv: { appUrl: 'https://app.test' } }))
vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdminClient: vi.fn() }))

import { recordFeePayment } from '../record-payment'
import { logger } from '@/lib/logging'

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

function seed(over: Partial<Row> = {}): Tables {
  return {
    invoices: [
      {
        id: 'inv1',
        school_id: 's1',
        student_id: 'c1',
        invoice_number: 'INV-1',
        net_parent_cents: 10000,
        amount_paid_cents: 0,
        status: 'issued',
        ...over,
      },
    ],
    late_collections: [
      {
        id: 'lc1',
        school_id: 's1',
        student_id: 'c1',
        fee_cents: 1500,
        amount_paid_cents: 0,
        paid_at: null,
      },
    ],
    payments: [],
    schools: [{ id: 's1', name: 'Little Acorns' }],
    students: [{ id: 'c1', first_name: 'Sam', last_name: 'Byrne' }],
    parent_student_links: [
      { parent_id: 'p1', student_id: 'c1', school_id: 's1', is_active: true },
      { parent_id: 'p2', student_id: 'c1', school_id: 's1', is_active: true },
    ],
    profiles: [
      { id: 'p1', email: 'mum@test.ie' },
      { id: 'p2', email: 'dad@test.ie' },
    ],
  }
}

const stripePay = (session: string, amount = 10000) => ({
  kind: 'invoice' as const,
  subjectId: 'inv1',
  provider: 'stripe' as const,
  amountCents: amount,
  currency: 'eur',
  checkoutSessionId: session,
  paymentIntentId: `pi_${session}`,
})

// The fake only implements what record-payment uses.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = (t: Tables) => fakeDb(t) as any

beforeEach(() => {
  sent.length = 0
  sendFails = false
  vi.mocked(logger.error).mockClear()
})

describe('recordFeePayment: invoices', () => {
  it('records the payment, marks the invoice paid and emails both parents a receipt', async () => {
    const t = seed()
    const r = await recordFeePayment(asDb(t), stripePay('cs_1'))
    expect(r).toEqual({ isNew: true, excessCents: 0 })
    expect(t.invoices![0]).toMatchObject({ status: 'paid', amount_paid_cents: 10000 })
    expect(t.payments).toHaveLength(1)
    expect(t.payments![0]).toMatchObject({
      invoice_id: 'inv1',
      amount_cents: 10000,
      currency: 'EUR',
    })
    expect(sent.map((s) => s.to).sort()).toEqual(['dad@test.ie', 'mum@test.ie'])
    expect(sent[0]!.subject).toBe('Payment received: €100.00 for Sam Byrne')
  })

  it('a retried webhook for the same session changes nothing and sends no second email', async () => {
    const t = seed()
    const db = asDb(t)
    await recordFeePayment(db, stripePay('cs_1'))
    sent.length = 0
    const r = await recordFeePayment(db, stripePay('cs_1'))
    expect(r).toEqual({ isNew: false, excessCents: 0 })
    expect(t.payments).toHaveLength(1)
    expect(t.invoices![0]).toMatchObject({ status: 'paid', amount_paid_cents: 10000 })
    expect(sent).toHaveLength(0)
  })

  it('a second, different payment is flagged as an overpayment and the crèche is alerted', async () => {
    const t = seed()
    const db = asDb(t)
    await recordFeePayment(db, stripePay('cs_1'))
    sent.length = 0
    const r = await recordFeePayment(db, stripePay('cs_2'))
    expect(r).toEqual({ isNew: true, excessCents: 10000 })
    expect(t.payments).toHaveLength(2) // the money is still recorded
    expect(t.invoices![0]).toMatchObject({ status: 'paid', amount_paid_cents: 10000 }) // capped
    expect(sent.find((s) => s.to === 'owner@creche.test')?.subject).toBe(
      'Action needed: €100.00 overpaid for Sam Byrne',
    )
    expect(logger.error).toHaveBeenCalledWith(
      'fee_overpayment',
      expect.objectContaining({ excessCents: 10000, reference: 'cs_2' }),
    )
  })

  it('payment on a voided invoice leaves it void and asks the crèche to refund all of it', async () => {
    const t = seed({ status: 'void' })
    const r = await recordFeePayment(asDb(t), stripePay('cs_1'))
    expect(r.excessCents).toBe(10000)
    expect(t.invoices![0]).toMatchObject({ status: 'void', amount_paid_cents: 0 })
    expect(sent.some((s) => s.to === 'owner@creche.test')).toBe(true)
  })

  it('Revolut payments are deduplicated by order id', async () => {
    const t = seed()
    const db = asDb(t)
    const rev = {
      kind: 'invoice' as const,
      subjectId: 'inv1',
      provider: 'revolut' as const,
      amountCents: 10000,
      currency: 'EUR',
      providerOrderId: 'rev-1',
    }
    await recordFeePayment(db, rev)
    const again = await recordFeePayment(db, rev)
    expect(again.isNew).toBe(false)
    expect(t.payments).toHaveLength(1)
    expect(t.invoices![0]).toMatchObject({ status: 'paid' })
  })

  it('an email failure never fails the webhook', async () => {
    sendFails = true
    const t = seed()
    await expect(recordFeePayment(asDb(t), stripePay('cs_1'))).resolves.toEqual({
      isNew: true,
      excessCents: 0,
    })
    expect(t.invoices![0]).toMatchObject({ status: 'paid' })
  })

  it('rejects a zero or negative amount', async () => {
    await expect(recordFeePayment(asDb(seed()), stripePay('cs_1', 0))).rejects.toThrow(
      /Invalid payment amount/,
    )
  })
})

describe('recordFeePayment: late fees', () => {
  const lateFee = (session: string) => ({
    kind: 'late_fee' as const,
    subjectId: 'lc1',
    provider: 'stripe' as const,
    amountCents: 1500,
    currency: 'eur',
    checkoutSessionId: session,
  })

  it('marks the fee paid once, and flags a duplicate payment instead of inflating it', async () => {
    const t = seed()
    const db = asDb(t)
    await recordFeePayment(db, lateFee('cs_a'))
    expect(t.late_collections![0]).toMatchObject({ amount_paid_cents: 1500 })
    expect(t.late_collections![0]!.paid_at).toBeTruthy()

    await recordFeePayment(db, lateFee('cs_a')) // retry
    const second = await recordFeePayment(db, lateFee('cs_b')) // paid again
    expect(second.excessCents).toBe(1500)
    expect(t.late_collections![0]).toMatchObject({ amount_paid_cents: 1500 })
    expect(t.payments).toHaveLength(2)
  })
})
