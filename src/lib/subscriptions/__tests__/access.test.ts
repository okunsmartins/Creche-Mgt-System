import { describe, it, expect } from 'vitest'
import { hasProAccess, hasSmsAccess, isFeatureAvailable, PAST_DUE_GRACE_DAYS } from '../access'
import type { SubscriptionRow } from '@/types/database'

type Access = Pick<SubscriptionRow, 'plan' | 'status' | 'current_period_end' | 'trial_ends_at'>

const NOW = new Date('2026-06-26T12:00:00Z')
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

function sub(partial: Partial<Access>): Access {
  return {
    plan: 'pro',
    status: 'active',
    current_period_end: null,
    trial_ends_at: null,
    ...partial,
  }
}

describe('hasProAccess', () => {
  it('no row → false (free)', () => {
    expect(hasProAccess(null, NOW)).toBe(false)
  })

  it('plan free → false even if status active', () => {
    expect(hasProAccess(sub({ plan: 'free', status: 'active' }), NOW)).toBe(false)
  })

  it('active → true', () => {
    expect(hasProAccess(sub({ status: 'active' }), NOW)).toBe(true)
  })

  it('trialing with no end date → true', () => {
    expect(hasProAccess(sub({ status: 'trialing' }), NOW)).toBe(true)
  })

  it('trialing with a future end date → true (trial still active)', () => {
    expect(hasProAccess(sub({ status: 'trialing', trial_ends_at: daysFromNow(5) }), NOW)).toBe(true)
  })

  it('trialing with a past end date → false (trial expired, must subscribe)', () => {
    expect(hasProAccess(sub({ status: 'trialing', trial_ends_at: daysFromNow(-1) }), NOW)).toBe(
      false,
    )
  })

  it('cancelled → false', () => {
    expect(hasProAccess(sub({ status: 'cancelled' }), NOW)).toBe(false)
  })

  it('incomplete → false', () => {
    expect(hasProAccess(sub({ status: 'incomplete' }), NOW)).toBe(false)
  })

  it('past_due within grace → true', () => {
    // period ended 3 days ago; grace is 7 days
    expect(
      hasProAccess(sub({ status: 'past_due', current_period_end: daysFromNow(-3) }), NOW),
    ).toBe(true)
  })

  it('past_due exactly at grace edge → true', () => {
    expect(
      hasProAccess(
        sub({ status: 'past_due', current_period_end: daysFromNow(-PAST_DUE_GRACE_DAYS) }),
        NOW,
      ),
    ).toBe(true)
  })

  it('past_due beyond grace → false', () => {
    expect(
      hasProAccess(
        sub({ status: 'past_due', current_period_end: daysFromNow(-(PAST_DUE_GRACE_DAYS + 1)) }),
        NOW,
      ),
    ).toBe(false)
  })

  it('past_due with unknown period end → true (do not lock prematurely)', () => {
    expect(hasProAccess(sub({ status: 'past_due', current_period_end: null }), NOW)).toBe(true)
  })
})

describe('isFeatureAvailable', () => {
  it('gates a pro feature behind access', () => {
    expect(isFeatureAvailable('payment_links', sub({ status: 'active' }), NOW)).toBe(true)
    expect(isFeatureAvailable('payment_links', sub({ status: 'cancelled' }), NOW)).toBe(false)
    expect(isFeatureAvailable('advanced_reports', null, NOW)).toBe(false)
  })
})

describe('hasSmsAccess (SMS included with the single plan)', () => {
  it('is false without a subscription', () => {
    expect(hasSmsAccess(null, NOW)).toBe(false)
  })

  it('is true for any active paid school (SMS is included, no separate entitlement)', () => {
    expect(hasSmsAccess(sub({ status: 'active' }), NOW)).toBe(true)
  })

  it('is true during an active trial', () => {
    expect(hasSmsAccess(sub({ status: 'trialing', trial_ends_at: daysFromNow(5) }), NOW)).toBe(true)
  })

  it('tracks plan access (cancelled ⇒ false)', () => {
    expect(hasSmsAccess(sub({ status: 'cancelled' }), NOW)).toBe(false)
  })

  it('honours the trial window (expired trial ⇒ false)', () => {
    expect(hasSmsAccess(sub({ status: 'trialing', trial_ends_at: daysFromNow(-1) }), NOW)).toBe(
      false,
    )
  })
})
