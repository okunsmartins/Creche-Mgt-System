import { describe, it, expect } from 'vitest'

// ─── Stripe webhook state machine: terminal state guard ───────────────────────
// Pure logic extracted for testing: which order statuses block a status transition.

// States that can never receive further payments or status downgrades
const PAYMENT_TERMINAL_STATUSES = new Set(['paid', 'partially_refunded', 'fully_refunded'])

// States that block expired / payment_failed updates (partially_paid orders
// keep their status if a follow-up session expires or fails)
const DEGRADATION_PROTECTED_STATUSES = new Set([
  'paid',
  'partially_paid',
  'partially_refunded',
  'fully_refunded',
])

function canReceivePayment(currentStatus: string): boolean {
  return !PAYMENT_TERMINAL_STATUSES.has(currentStatus)
}

function canBeMarkedExpiredOrFailed(currentStatus: string): boolean {
  return !DEGRADATION_PROTECTED_STATUSES.has(currentStatus)
}

describe('order status state machine', () => {
  it('allows transition to paid from draft', () => {
    expect(canReceivePayment('draft')).toBe(true)
  })

  it('allows transition to paid from pending_payment', () => {
    expect(canReceivePayment('pending_payment')).toBe(true)
  })

  it('allows transition to paid from partially_paid', () => {
    expect(canReceivePayment('partially_paid')).toBe(true)
  })

  it('blocks transition to paid when already paid', () => {
    expect(canReceivePayment('paid')).toBe(false)
  })

  it('blocks any payment transition when partially_refunded', () => {
    expect(canReceivePayment('partially_refunded')).toBe(false)
  })

  it('blocks any payment transition when fully_refunded', () => {
    expect(canReceivePayment('fully_refunded')).toBe(false)
  })

  it('allows expired update from pending_payment', () => {
    expect(canBeMarkedExpiredOrFailed('pending_payment')).toBe(true)
  })

  it('allows payment_failed update from draft', () => {
    expect(canBeMarkedExpiredOrFailed('draft')).toBe(true)
  })

  it('blocks expired update when order is partially_paid', () => {
    expect(canBeMarkedExpiredOrFailed('partially_paid')).toBe(false)
  })

  it('blocks payment_failed update when order is partially_paid', () => {
    expect(canBeMarkedExpiredOrFailed('partially_paid')).toBe(false)
  })

  it('blocks expired update when already paid', () => {
    expect(canBeMarkedExpiredOrFailed('paid')).toBe(false)
  })

  it('blocks payment_failed update when partially_refunded', () => {
    expect(canBeMarkedExpiredOrFailed('partially_refunded')).toBe(false)
  })

  it('blocks expired update when fully_refunded', () => {
    expect(canBeMarkedExpiredOrFailed('fully_refunded')).toBe(false)
  })
})

// ─── Rate limiter ─────────────────────────────────────────────────────────────

function makeRateLimiter(windowMs: number, maxRequests: number) {
  const store = new Map<string, { count: number; windowStart: number }>()
  return function checkRateLimit(key: string, now: number): boolean {
    const entry = store.get(key)
    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(key, { count: 1, windowStart: now })
      return true
    }
    entry.count++
    return entry.count <= maxRequests
  }
}

describe('rate limiter', () => {
  it('allows requests up to the limit within the window', () => {
    const check = makeRateLimiter(60_000, 3)
    expect(check('ip:1.2.3.4', 0)).toBe(true)
    expect(check('ip:1.2.3.4', 1000)).toBe(true)
    expect(check('ip:1.2.3.4', 2000)).toBe(true)
  })

  it('blocks the request that exceeds the limit', () => {
    const check = makeRateLimiter(60_000, 3)
    check('ip:1.2.3.4', 0)
    check('ip:1.2.3.4', 1000)
    check('ip:1.2.3.4', 2000)
    expect(check('ip:1.2.3.4', 3000)).toBe(false)
  })

  it('resets the window after the window period expires', () => {
    const check = makeRateLimiter(60_000, 2)
    check('ip:1.2.3.4', 0)
    check('ip:1.2.3.4', 1000)
    expect(check('ip:1.2.3.4', 2000)).toBe(false)
    // After window expires, the count resets
    expect(check('ip:1.2.3.4', 70_000)).toBe(true)
  })

  it('tracks keys independently', () => {
    const check = makeRateLimiter(60_000, 1)
    expect(check('ip:1.2.3.4', 0)).toBe(true)
    expect(check('ip:9.9.9.9', 0)).toBe(true)
  })

  it('blocks the second request for a limit of 1', () => {
    const check = makeRateLimiter(60_000, 1)
    expect(check('ip:1.2.3.4', 0)).toBe(true)
    expect(check('ip:1.2.3.4', 100)).toBe(false)
  })
})

// ─── Webhook payment_status guard (§11.3) ────────────────────────────────────
// The handler must only advance to 'paid' when Stripe confirms payment_status === 'paid'.

function shouldProcessAsPayment(paymentStatus: string | null): boolean {
  return paymentStatus === 'paid'
}

describe('checkout.session.completed payment_status guard', () => {
  it('processes sessions with payment_status paid', () => {
    expect(shouldProcessAsPayment('paid')).toBe(true)
  })

  it('does not process sessions with payment_status unpaid', () => {
    expect(shouldProcessAsPayment('unpaid')).toBe(false)
  })

  it('does not process sessions with payment_status no_payment_required', () => {
    expect(shouldProcessAsPayment('no_payment_required')).toBe(false)
  })

  it('does not process sessions with null payment_status', () => {
    expect(shouldProcessAsPayment(null)).toBe(false)
  })
})

// ─── FR-PAY-003 currency and amount verification (§11.2 step 6) ──────────────
// Webhook must reject wrong currency and amounts outside the valid range.
// For installment payments, sessionAmountTotal may be less than orderTotalCents —
// what matters is that it is positive and does not exceed the remaining balance.

function verifyCurrency(
  sessionCurrency: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (sessionCurrency?.toLowerCase() !== 'eur') {
    return { ok: false, reason: `currency: expected eur, got ${sessionCurrency ?? 'null'}` }
  }
  return { ok: true }
}

function verifyAmountAgainstBalance(params: {
  sessionAmountTotal: number | null
  remainingCents: number
}): { ok: true } | { ok: false; reason: string } {
  const { sessionAmountTotal, remainingCents } = params
  if (!sessionAmountTotal || sessionAmountTotal <= 0) {
    return { ok: false, reason: `amount: must be positive, got ${sessionAmountTotal ?? 'null'}` }
  }
  if (sessionAmountTotal > remainingCents) {
    return {
      ok: false,
      reason: `amount: ${sessionAmountTotal} exceeds remaining balance ${remainingCents}`,
    }
  }
  return { ok: true }
}

describe('FR-PAY-003 currency verification', () => {
  it('accepts EUR currency', () => {
    expect(verifyCurrency('eur')).toEqual({ ok: true })
  })

  it('accepts EUR in uppercase (Stripe may return mixed case)', () => {
    expect(verifyCurrency('EUR')).toEqual({ ok: true })
  })

  it('rejects non-EUR currency', () => {
    const result = verifyCurrency('usd')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/currency/)
  })

  it('rejects null currency', () => {
    expect(verifyCurrency(null).ok).toBe(false)
  })
})

describe('FR-PAY-003 installment amount verification', () => {
  it('accepts full payment equal to remaining balance', () => {
    expect(verifyAmountAgainstBalance({ sessionAmountTotal: 8000, remainingCents: 8000 })).toEqual({
      ok: true,
    })
  })

  it('accepts partial payment less than remaining balance', () => {
    expect(verifyAmountAgainstBalance({ sessionAmountTotal: 4000, remainingCents: 8000 })).toEqual({
      ok: true,
    })
  })

  it('accepts final instalment that clears the balance', () => {
    expect(verifyAmountAgainstBalance({ sessionAmountTotal: 4000, remainingCents: 4000 })).toEqual({
      ok: true,
    })
  })

  it('rejects payment exceeding remaining balance', () => {
    const result = verifyAmountAgainstBalance({ sessionAmountTotal: 9000, remainingCents: 8000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/exceeds/)
  })

  it('rejects zero amount', () => {
    expect(verifyAmountAgainstBalance({ sessionAmountTotal: 0, remainingCents: 8000 }).ok).toBe(
      false,
    )
  })

  it('rejects null amount', () => {
    expect(verifyAmountAgainstBalance({ sessionAmountTotal: null, remainingCents: 8000 }).ok).toBe(
      false,
    )
  })
})

// ─── Installment status machine ───────────────────────────────────────────────

function computeNewOrderStatus(params: {
  totalCents: number
  amountPaidCents: number
  sessionAmountCents: number
}): 'paid' | 'partially_paid' {
  const newPaid = params.amountPaidCents + params.sessionAmountCents
  return newPaid >= params.totalCents ? 'paid' : 'partially_paid'
}

describe('installment order status transitions', () => {
  it('marks order paid when payment clears full balance', () => {
    expect(
      computeNewOrderStatus({ totalCents: 8000, amountPaidCents: 0, sessionAmountCents: 8000 }),
    ).toBe('paid')
  })

  it('marks order partially_paid when first instalment does not clear balance', () => {
    expect(
      computeNewOrderStatus({ totalCents: 8000, amountPaidCents: 0, sessionAmountCents: 4000 }),
    ).toBe('partially_paid')
  })

  it('marks order paid when final instalment clears remaining balance', () => {
    expect(
      computeNewOrderStatus({ totalCents: 8000, amountPaidCents: 4000, sessionAmountCents: 4000 }),
    ).toBe('paid')
  })

  it('remains partially_paid when instalment still leaves a balance', () => {
    expect(
      computeNewOrderStatus({ totalCents: 8000, amountPaidCents: 4000, sessionAmountCents: 2000 }),
    ).toBe('partially_paid')
  })

  it('marks paid when overpayment due to rounding covers the total', () => {
    // e.g. total 8000, paid 7999, session 1 → 8000 >= 8000
    expect(
      computeNewOrderStatus({ totalCents: 8000, amountPaidCents: 7999, sessionAmountCents: 1 }),
    ).toBe('paid')
  })
})

// ─── Checkout session line item construction ──────────────────────────────────
// Verifies that unit amounts come from the DB snapshot, never from external input.

describe('checkout line item builder', () => {
  type OrderItem = { id: string; activity_name_snapshot: string; unit_amount_cents: number }

  function buildLineItems(items: OrderItem[]) {
    return items.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: item.activity_name_snapshot },
        unit_amount: item.unit_amount_cents,
      },
      quantity: 1,
    }))
  }

  it('uses activity_name_snapshot for the product name', () => {
    const items: OrderItem[] = [
      { id: 'i1', activity_name_snapshot: 'Swimming Lessons', unit_amount_cents: 1000 },
    ]
    const lineItems = buildLineItems(items)
    expect(lineItems[0]?.price_data.product_data.name).toBe('Swimming Lessons')
  })

  it('uses unit_amount_cents as the Stripe unit_amount', () => {
    const items: OrderItem[] = [
      { id: 'i1', activity_name_snapshot: 'Swimming', unit_amount_cents: 1500 },
    ]
    const lineItems = buildLineItems(items)
    expect(lineItems[0]?.price_data.unit_amount).toBe(1500)
  })

  it('uses EUR as the currency', () => {
    const items: OrderItem[] = [
      { id: 'i1', activity_name_snapshot: 'Trip', unit_amount_cents: 500 },
    ]
    const lineItems = buildLineItems(items)
    expect(lineItems[0]?.price_data.currency).toBe('eur')
  })

  it('produces one line item per order item', () => {
    const items: OrderItem[] = [
      { id: 'i1', activity_name_snapshot: 'A', unit_amount_cents: 100 },
      { id: 'i2', activity_name_snapshot: 'B', unit_amount_cents: 200 },
      { id: 'i3', activity_name_snapshot: 'C', unit_amount_cents: 300 },
    ]
    expect(buildLineItems(items)).toHaveLength(3)
  })

  it('sets quantity to 1 for each item', () => {
    const items: OrderItem[] = [{ id: 'i1', activity_name_snapshot: 'X', unit_amount_cents: 999 }]
    expect(buildLineItems(items)[0]?.quantity).toBe(1)
  })
})

// ─── Refund status machine (charge.refunded webhook) ─────────────────────────
// Pure logic mirroring handleChargeRefunded in src/app/api/webhooks/stripe/route.ts.
// Tests cover the three branches: partially_paid, fully_refunded, partially_refunded.

type RefundStatusInput = {
  currentStatus: string
  totalCents: number
  currentAmountPaid: number
  amountRefunded: number
}
type RefundStatusOutput = {
  newStatus: string
  newAmountPaid: number
}

function computeRefundOutcome(input: RefundStatusInput): RefundStatusOutput {
  const { currentStatus, totalCents, currentAmountPaid, amountRefunded } = input

  if (currentStatus === 'partially_paid') {
    // charge covers only the deposit, so currentAmountPaid is the correct baseline
    const newAmountPaid = Math.max(0, currentAmountPaid - amountRefunded)
    return {
      newStatus: newAmountPaid <= 0 ? 'pending_payment' : 'partially_paid',
      newAmountPaid,
    }
  }

  if (amountRefunded >= totalCents) {
    return { newStatus: 'fully_refunded', newAmountPaid: 0 }
  }

  if (amountRefunded > 0) {
    // charge.amount_refunded is Stripe's cumulative total — use totalCents as the
    // baseline so that multiple incremental refunds produce the correct remaining balance
    // even when currentAmountPaid was already decremented by a prior refund event.
    return {
      newStatus: 'partially_refunded',
      newAmountPaid: Math.max(0, totalCents - amountRefunded),
    }
  }

  // No refund amount — no change (shouldn't reach Stripe webhook, but guard)
  return { newStatus: currentStatus, newAmountPaid: currentAmountPaid }
}

describe('charge.refunded status machine — partially_paid branch', () => {
  it('reverts to pending_payment when full deposit is refunded', () => {
    const result = computeRefundOutcome({
      currentStatus: 'partially_paid',
      totalCents: 8000,
      currentAmountPaid: 4000,
      amountRefunded: 4000,
    })
    expect(result.newStatus).toBe('pending_payment')
    expect(result.newAmountPaid).toBe(0)
  })

  it('stays partially_paid when deposit is only partially refunded', () => {
    const result = computeRefundOutcome({
      currentStatus: 'partially_paid',
      totalCents: 8000,
      currentAmountPaid: 4000,
      amountRefunded: 2000,
    })
    expect(result.newStatus).toBe('partially_paid')
    expect(result.newAmountPaid).toBe(2000)
  })

  it('clamps amount_paid_cents to 0 when refund exceeds deposit', () => {
    const result = computeRefundOutcome({
      currentStatus: 'partially_paid',
      totalCents: 8000,
      currentAmountPaid: 4000,
      amountRefunded: 5000,
    })
    expect(result.newStatus).toBe('pending_payment')
    expect(result.newAmountPaid).toBe(0)
  })
})

describe('charge.refunded status machine — paid / partially_refunded branch', () => {
  it('transitions paid → fully_refunded when full amount is refunded', () => {
    const result = computeRefundOutcome({
      currentStatus: 'paid',
      totalCents: 8000,
      currentAmountPaid: 8000,
      amountRefunded: 8000,
    })
    expect(result.newStatus).toBe('fully_refunded')
    expect(result.newAmountPaid).toBe(0)
  })

  it('transitions paid → partially_refunded for a partial refund', () => {
    const result = computeRefundOutcome({
      currentStatus: 'paid',
      totalCents: 8000,
      currentAmountPaid: 8000,
      amountRefunded: 3000,
    })
    expect(result.newStatus).toBe('partially_refunded')
    expect(result.newAmountPaid).toBe(5000)
  })

  it('transitions partially_refunded → fully_refunded when cumulative refund covers total', () => {
    const result = computeRefundOutcome({
      currentStatus: 'partially_refunded',
      totalCents: 8000,
      currentAmountPaid: 5000,
      amountRefunded: 8000,
    })
    expect(result.newStatus).toBe('fully_refunded')
    expect(result.newAmountPaid).toBe(0)
  })

  // Regression: charge.amount_refunded is cumulative from Stripe.
  // When a second incremental refund fires, currentAmountPaid has already been
  // decremented by the first refund. Using totalCents as the baseline avoids
  // double-counting the first refund amount.
  it('computes amount_paid_cents from totalCents when a second incremental refund fires on a partially_refunded order', () => {
    // Order €80 paid in full → first refund of €20 → amount_paid_cents = 6000 (partially_refunded)
    // Stripe fires another charge.refunded: cumulative amount_refunded = €50 (20 + 30)
    const result = computeRefundOutcome({
      currentStatus: 'partially_refunded',
      totalCents: 8000,
      currentAmountPaid: 6000, // already decremented by first €20 refund
      amountRefunded: 5000, // cumulative from Stripe (€20 + €30)
    })
    expect(result.newStatus).toBe('partially_refunded')
    // Correct: 8000 − 5000 = 3000  (not 6000 − 5000 = 1000)
    expect(result.newAmountPaid).toBe(3000)
  })

  it('stays partially_refunded when cumulative refund is less than total', () => {
    const result = computeRefundOutcome({
      currentStatus: 'paid',
      totalCents: 8000,
      currentAmountPaid: 8000,
      amountRefunded: 1000,
    })
    expect(result.newStatus).toBe('partially_refunded')
    expect(result.newAmountPaid).toBe(7000)
  })
})
