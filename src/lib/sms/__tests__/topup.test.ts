import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { SMS_TOPUP_BUNDLES, getSmsTopupBundle } from '../topup'
import { isSmsTopupSession } from '../topupWebhook'

describe('SMS top-up bundles', () => {
  it('exposes the three decided bundles at the agreed prices', () => {
    expect(SMS_TOPUP_BUNDLES).toEqual([
      { id: 'sms-10', credits: 100, priceCents: 1000 },
      { id: 'sms-25', credits: 275, priceCents: 2500 },
      { id: 'sms-50', credits: 600, priceCents: 5000 },
    ])
  })

  it('every bundle prices credits above the ~€0.074 Twilio cost (positive margin)', () => {
    for (const b of SMS_TOPUP_BUNDLES) {
      const perText = b.priceCents / 100 / b.credits
      expect(perText).toBeGreaterThan(0.074)
    }
  })

  it('resolves a known bundle and rejects an unknown one', () => {
    expect(getSmsTopupBundle('sms-25')).toEqual({ id: 'sms-25', credits: 275, priceCents: 2500 })
    expect(getSmsTopupBundle('nope')).toBeNull()
  })
})

describe('isSmsTopupSession', () => {
  const make = (metadata: Record<string, string> | null) =>
    ({ metadata }) as unknown as Stripe.Checkout.Session

  it('is true only for the sms_topup metadata flag', () => {
    expect(isSmsTopupSession(make({ type: 'sms_topup', school_id: 's', credits: '100' }))).toBe(
      true,
    )
    expect(isSmsTopupSession(make({ order_id: 'o1' }))).toBe(false)
    expect(isSmsTopupSession(make(null))).toBe(false)
  })
})
