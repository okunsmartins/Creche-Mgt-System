import { describe, it, expect } from 'vitest'
import { initiateRefundSchema } from '../schemas'

const VALID_UUID = 'a0000000-0000-0000-0000-000000000001'
const VALID_UUID_2 = 'a0000000-0000-0000-0000-000000000002'

describe('initiateRefundSchema', () => {
  const valid = {
    orderId: VALID_UUID,
    paymentId: VALID_UUID_2,
    amountEuros: '10.50',
    reason: 'Customer requested refund',
  }

  it('accepts a valid refund request', () => {
    const result = initiateRefundSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('transforms amountEuros string "10.50" to 1050 cents', () => {
    const result = initiateRefundSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amountEuros).toBe(1050)
  })

  it('transforms whole-number amount "5" to 500 cents', () => {
    const result = initiateRefundSchema.safeParse({ ...valid, amountEuros: '5' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amountEuros).toBe(500)
  })

  it('accepts exactly 2 decimal places', () => {
    const result = initiateRefundSchema.safeParse({ ...valid, amountEuros: '12.99' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amountEuros).toBe(1299)
  })

  it('rejects amount with 3 decimal places', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, amountEuros: '10.123' }).success).toBe(false)
  })

  it('rejects non-numeric amount', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, amountEuros: 'abc' }).success).toBe(false)
  })

  it('rejects empty amount string', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, amountEuros: '' }).success).toBe(false)
  })

  it('rejects invalid orderId', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, orderId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects invalid paymentId', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, paymentId: 'not-a-uuid' }).success).toBe(
      false,
    )
  })

  it('rejects reason shorter than 3 characters', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, reason: 'ab' }).success).toBe(false)
  })

  it('rejects reason longer than 500 characters', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, reason: 'a'.repeat(501) }).success).toBe(
      false,
    )
  })

  it('accepts reason of exactly 3 characters', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, reason: 'abc' }).success).toBe(true)
  })

  it('accepts reason of exactly 500 characters', () => {
    expect(initiateRefundSchema.safeParse({ ...valid, reason: 'a'.repeat(500) }).success).toBe(true)
  })
})

// ─── Refund ceiling (§11.4) ───────────────────────────────────────────────────
// sum of pending + processing + succeeded refunds must not exceed payment amount

function computeRefundCeiling(params: {
  paymentAmountCents: number
  existingRefundsCents: number
  requestedCents: number
}): { allowed: true } | { allowed: false; reason: string } {
  const { paymentAmountCents, existingRefundsCents, requestedCents } = params
  const available = paymentAmountCents - existingRefundsCents
  if (requestedCents <= 0) {
    return { allowed: false, reason: 'Refund amount must be greater than zero' }
  }
  if (requestedCents > available) {
    return {
      allowed: false,
      reason: `Exceeds refundable balance of ${(available / 100).toFixed(2)} EUR`,
    }
  }
  return { allowed: true }
}

describe('refund ceiling (§11.4)', () => {
  it('allows full refund when no prior refunds', () => {
    expect(
      computeRefundCeiling({
        paymentAmountCents: 1500,
        existingRefundsCents: 0,
        requestedCents: 1500,
      }),
    ).toEqual({ allowed: true })
  })

  it('allows partial refund within available balance', () => {
    expect(
      computeRefundCeiling({
        paymentAmountCents: 1500,
        existingRefundsCents: 0,
        requestedCents: 500,
      }),
    ).toEqual({ allowed: true })
  })

  it('allows refund of remaining balance after partial', () => {
    expect(
      computeRefundCeiling({
        paymentAmountCents: 1500,
        existingRefundsCents: 500,
        requestedCents: 1000,
      }),
    ).toEqual({ allowed: true })
  })

  it('blocks refund of 1 cent more than original amount', () => {
    const result = computeRefundCeiling({
      paymentAmountCents: 1500,
      existingRefundsCents: 0,
      requestedCents: 1501,
    })
    expect(result.allowed).toBe(false)
  })

  it('blocks any further refund when fully refunded', () => {
    const result = computeRefundCeiling({
      paymentAmountCents: 1500,
      existingRefundsCents: 1500,
      requestedCents: 1,
    })
    expect(result.allowed).toBe(false)
  })

  it('blocks refund that exceeds remaining balance', () => {
    const result = computeRefundCeiling({
      paymentAmountCents: 1500,
      existingRefundsCents: 1000,
      requestedCents: 501,
    })
    expect(result.allowed).toBe(false)
  })

  it('blocks zero-amount refund', () => {
    expect(
      computeRefundCeiling({ paymentAmountCents: 1500, existingRefundsCents: 0, requestedCents: 0 })
        .allowed,
    ).toBe(false)
  })

  it('blocks negative refund amount', () => {
    expect(
      computeRefundCeiling({
        paymentAmountCents: 1500,
        existingRefundsCents: 0,
        requestedCents: -100,
      }).allowed,
    ).toBe(false)
  })
})

// ─── Refund order status state machine ────────────────────────────────────────
// paid → partially_refunded → fully_refunded; never backward

function nextRefundStatus(params: {
  currentStatus: string
  totalRefundedCents: number
  paymentAmountCents: number
}): 'partially_refunded' | 'fully_refunded' | null {
  const { currentStatus, totalRefundedCents, paymentAmountCents } = params
  if (currentStatus !== 'paid' && currentStatus !== 'partially_refunded') return null
  return totalRefundedCents >= paymentAmountCents ? 'fully_refunded' : 'partially_refunded'
}

describe('refund order status state machine', () => {
  it('paid → fully_refunded when entire amount is refunded', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'paid',
        totalRefundedCents: 1500,
        paymentAmountCents: 1500,
      }),
    ).toBe('fully_refunded')
  })

  it('paid → partially_refunded on partial refund', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'paid',
        totalRefundedCents: 500,
        paymentAmountCents: 1500,
      }),
    ).toBe('partially_refunded')
  })

  it('partially_refunded → fully_refunded when remaining balance is cleared', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'partially_refunded',
        totalRefundedCents: 1500,
        paymentAmountCents: 1500,
      }),
    ).toBe('fully_refunded')
  })

  it('partially_refunded → partially_refunded when balance remains', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'partially_refunded',
        totalRefundedCents: 800,
        paymentAmountCents: 1500,
      }),
    ).toBe('partially_refunded')
  })

  it('returns null for fully_refunded (terminal state)', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'fully_refunded',
        totalRefundedCents: 1500,
        paymentAmountCents: 1500,
      }),
    ).toBeNull()
  })

  it('returns null for pending_payment (not refundable)', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'pending_payment',
        totalRefundedCents: 1500,
        paymentAmountCents: 1500,
      }),
    ).toBeNull()
  })

  it('returns null for expired (not refundable)', () => {
    expect(
      nextRefundStatus({
        currentStatus: 'expired',
        totalRefundedCents: 0,
        paymentAmountCents: 1500,
      }),
    ).toBeNull()
  })
})
