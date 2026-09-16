import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { mapStatus, planForStatus } from '../status'

describe('mapStatus', () => {
  const cases: [Stripe.Subscription.Status, string][] = [
    ['active', 'active'],
    ['trialing', 'trialing'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['paused', 'past_due'],
    ['canceled', 'cancelled'],
    ['incomplete_expired', 'cancelled'],
    ['incomplete', 'incomplete'],
  ]

  it.each(cases)('maps Stripe %s → %s', (stripeStatus, expected) => {
    expect(mapStatus(stripeStatus)).toBe(expected)
  })
})

describe('planForStatus', () => {
  it('grants pro for entitled statuses (active, trialing, past_due)', () => {
    expect(planForStatus('active')).toBe('pro')
    expect(planForStatus('trialing')).toBe('pro')
    // past_due keeps pro so the grace window (Phase 4) still has access
    expect(planForStatus('past_due')).toBe('pro')
  })

  it('reverts to free for cancelled / incomplete', () => {
    expect(planForStatus('cancelled')).toBe('free')
    expect(planForStatus('incomplete')).toBe('free')
  })
})
