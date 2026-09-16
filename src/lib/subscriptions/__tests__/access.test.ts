import { describe, it, expect } from 'vitest'
import {
  hasProAccess,
  hasSmsAccess,
  isFeatureAvailable,
  tierSwitchMode,
  PAST_DUE_GRACE_DAYS,
} from '../access'
import type { SubscriptionRow } from '@/types/database'

type Access = Pick<SubscriptionRow, 'plan' | 'status' | 'current_period_end' | 'trial_ends_at'>
type SmsAccess = Access & Pick<SubscriptionRow, 'sms_enabled'>

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

describe('hasSmsAccess', () => {
  const smsSub = (partial: Partial<SmsAccess>): SmsAccess => ({
    plan: 'pro',
    status: 'active',
    current_period_end: null,
    trial_ends_at: null,
    sms_enabled: true,
    ...partial,
  })

  it('is false without a subscription', () => {
    expect(hasSmsAccess(null, NOW)).toBe(false)
  })

  it('is false for an active Pro school without the SMS entitlement', () => {
    expect(hasSmsAccess(smsSub({ sms_enabled: false }), NOW)).toBe(false)
  })

  it('is true for an active Pro+SMS school', () => {
    expect(hasSmsAccess(smsSub({ sms_enabled: true }), NOW)).toBe(true)
  })

  it('requires current Pro access even with the entitlement set (cancelled ⇒ false)', () => {
    expect(hasSmsAccess(smsSub({ status: 'cancelled', sms_enabled: true }), NOW)).toBe(false)
  })

  it('honours the trial window (expired trial ⇒ false)', () => {
    expect(hasSmsAccess(smsSub({ status: 'trialing', trial_ends_at: daysFromNow(-1) }), NOW)).toBe(
      false,
    )
  })
})

describe('tierSwitchMode', () => {
  it('no subscription row → checkout (fresh subscribe)', () => {
    expect(tierSwitchMode(null, false)).toBe('checkout')
  })

  it('already on SMS with access → already_on_sms (no-op)', () => {
    expect(tierSwitchMode({ stripe_subscription_id: 'sub_1', sms_enabled: true }, true)).toBe(
      'already_on_sms',
    )
  })

  it('active Pro (Stripe sub, no SMS) → modify in place', () => {
    expect(tierSwitchMode({ stripe_subscription_id: 'sub_1', sms_enabled: false }, true)).toBe(
      'modify',
    )
  })

  it('local signup trial (no Stripe sub) with access → checkout', () => {
    expect(tierSwitchMode({ stripe_subscription_id: null, sms_enabled: false }, true)).toBe(
      'checkout',
    )
  })

  it('lapsed Pro (has Stripe sub but no access) → checkout, not modify', () => {
    expect(tierSwitchMode({ stripe_subscription_id: 'sub_1', sms_enabled: false }, false)).toBe(
      'checkout',
    )
  })

  it('SMS flag set but access lapsed → checkout (must resubscribe, not treated as done)', () => {
    expect(tierSwitchMode({ stripe_subscription_id: 'sub_1', sms_enabled: true }, false)).toBe(
      'checkout',
    )
  })
})
