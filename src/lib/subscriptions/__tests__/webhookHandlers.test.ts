import { describe, it, expect, vi } from 'vitest'
import type Stripe from 'stripe'

// Mock the email module so importing the handlers doesn't pull in Resend/env at
// module load — these tests only exercise the pure mapping helpers.
vi.mock('../emails', () => ({
  sendSubscriptionPaymentFailedEmail: vi.fn(),
  sendSubscriptionEndedEmail: vi.fn(),
}))

import {
  buildSubscriptionSyncPayload,
  getCurrentPeriodEnd,
  getInvoiceSubscriptionId,
  shouldSendDunningEmail,
  handleSubscriptionDeleted,
  shouldApplySubscriptionSync,
} from '../webhookHandlers'

/**
 * Chainable Supabase stub that records every `.eq()` filter applied to the
 * update, and resolves like a PostgREST builder when awaited.
 */
function makeClientStub() {
  const eqCalls: [string, unknown][] = []

  // update(...).eq(...).eq(...) — records filters, resolves like PostgREST.
  const updateBuilder: Record<string, unknown> = {}
  updateBuilder.eq = (col: string, val: unknown) => {
    eqCalls.push([col, val])
    return updateBuilder
  }
  updateBuilder.then = (resolve: (v: { error: null }) => unknown) => resolve({ error: null })

  // select(...) is used by schoolIdByCustomer when there is no school_id metadata.
  const selectBuilder: Record<string, unknown> = {}
  selectBuilder.eq = () => selectBuilder
  selectBuilder.maybeSingle = async () => ({ data: null })

  const client = {
    from: () => ({ update: () => updateBuilder, select: () => selectBuilder }),
  }
  return { client, eqCalls }
}

// Minimal Stripe.Subscription shape for the fields the mappers read.
function makeSub(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    current_period_end: 1_700_000_000, // 2023-11-14T22:13:20Z
    metadata: {},
    ...overrides,
  } as unknown as Stripe.Subscription
}

describe('buildSubscriptionSyncPayload', () => {
  it('maps an active subscription to a pro/active payload', () => {
    const payload = buildSubscriptionSyncPayload(makeSub())
    expect(payload).toEqual({
      stripe_subscription_id: 'sub_123',
      stripe_customer_id: 'cus_123',
      plan: 'pro',
      status: 'active',
      current_period_end: '2023-11-14T22:13:20.000Z',
      cancel_at_period_end: false,
      trial_ends_at: null,
      sms_enabled: false,
    })
  })

  it('sets sms_enabled when the subscription is on a configured Pro+SMS price', () => {
    const sub = makeSub({ items: { data: [{ price: { id: 'price_sms_monthly' } }] } })
    const payload = buildSubscriptionSyncPayload(sub, ['price_sms_monthly', 'price_sms_annual'])
    expect(payload.sms_enabled).toBe(true)
  })

  it('leaves sms_enabled false for a plain Pro price', () => {
    const sub = makeSub({ items: { data: [{ price: { id: 'price_pro_monthly' } }] } })
    const payload = buildSubscriptionSyncPayload(sub, ['price_sms_monthly', 'price_sms_annual'])
    expect(payload.sms_enabled).toBe(false)
  })

  it('never enables SMS when no SMS price ids are configured', () => {
    const sub = makeSub({ items: { data: [{ price: { id: 'price_sms_monthly' } }] } })
    expect(buildSubscriptionSyncPayload(sub, []).sms_enabled).toBe(false)
    expect(buildSubscriptionSyncPayload(sub).sms_enabled).toBe(false)
  })

  it('carries trialing status, trial end date and keeps pro plan', () => {
    const payload = buildSubscriptionSyncPayload(
      makeSub({ status: 'trialing', trial_end: 1_700_500_000 }),
    )
    expect(payload.status).toBe('trialing')
    expect(payload.plan).toBe('pro')
    expect(payload.trial_ends_at).toBe('2023-11-20T17:06:40.000Z')
  })

  it('reverts plan to free when cancelled and surfaces cancel_at_period_end', () => {
    const payload = buildSubscriptionSyncPayload(
      makeSub({ status: 'canceled', cancel_at_period_end: true }),
    )
    expect(payload.status).toBe('cancelled')
    expect(payload.plan).toBe('free')
    expect(payload.cancel_at_period_end).toBe(true)
  })

  it('resolves the customer id from an expanded customer object', () => {
    const payload = buildSubscriptionSyncPayload(makeSub({ customer: { id: 'cus_obj' } }))
    expect(payload.stripe_customer_id).toBe('cus_obj')
  })

  it('tolerates a missing period end (null rather than throwing)', () => {
    const payload = buildSubscriptionSyncPayload(makeSub({ current_period_end: undefined }))
    expect(payload.current_period_end).toBeNull()
  })
})

describe('getCurrentPeriodEnd', () => {
  it('reads the top-level field (older Stripe API)', () => {
    expect(getCurrentPeriodEnd(makeSub({ current_period_end: 111 }))).toBe(111)
  })

  it('falls back to the first item period end (newer Stripe API)', () => {
    const sub = makeSub({
      current_period_end: undefined,
      items: { data: [{ current_period_end: 222 }] },
    })
    expect(getCurrentPeriodEnd(sub)).toBe(222)
  })

  it('returns null when neither is present', () => {
    expect(getCurrentPeriodEnd(makeSub({ current_period_end: undefined }))).toBeNull()
  })
})

describe('getInvoiceSubscriptionId', () => {
  it('reads a string subscription id', () => {
    const inv = { subscription: 'sub_abc' } as unknown as Stripe.Invoice
    expect(getInvoiceSubscriptionId(inv)).toBe('sub_abc')
  })

  it('reads an expanded subscription object', () => {
    const inv = { subscription: { id: 'sub_obj' } } as unknown as Stripe.Invoice
    expect(getInvoiceSubscriptionId(inv)).toBe('sub_obj')
  })

  it('falls back to parent.subscription_details (newer Stripe API)', () => {
    const inv = {
      parent: { subscription_details: { subscription: 'sub_parent' } },
    } as unknown as Stripe.Invoice
    expect(getInvoiceSubscriptionId(inv)).toBe('sub_parent')
  })

  it('returns null for a non-subscription invoice', () => {
    expect(getInvoiceSubscriptionId({} as unknown as Stripe.Invoice)).toBeNull()
  })
})

describe('shouldSendDunningEmail', () => {
  it('sends on the first transition into past_due (was active/trialing/incomplete)', () => {
    expect(shouldSendDunningEmail('active')).toBe(true)
    expect(shouldSendDunningEmail('trialing')).toBe(true)
    expect(shouldSendDunningEmail('incomplete')).toBe(true)
  })

  it('does not re-send on dunning retries (already past_due) or after cancellation', () => {
    expect(shouldSendDunningEmail('past_due')).toBe(false)
    expect(shouldSendDunningEmail('cancelled')).toBe(false)
  })

  it('does not send when there is no prior row', () => {
    expect(shouldSendDunningEmail(null)).toBe(false)
    expect(shouldSendDunningEmail(undefined)).toBe(false)
  })
})

describe('handleSubscriptionDeleted', () => {
  it('scopes the cancellation to the subscription currently on the row', async () => {
    // A school can hold several Stripe subscriptions (lapsed then resubscribed).
    // Cancelling a superseded one must NOT revoke access from the live one, so the
    // update has to be filtered by stripe_subscription_id as well as the school.
    const { client, eqCalls } = makeClientStub()
    await handleSubscriptionDeleted(
      makeSub({ id: 'sub_stale', metadata: { school_id: 'school_1' } }),
      client as never,
    )
    expect(eqCalls).toContainEqual(['school_id', 'school_1'])
    expect(eqCalls).toContainEqual(['stripe_subscription_id', 'sub_stale'])
  })

  it('falls back to the customer when no school_id metadata is present', async () => {
    const { client, eqCalls } = makeClientStub()
    await handleSubscriptionDeleted(
      makeSub({ id: 'sub_x', customer: 'cus_9', metadata: {} }),
      client as never,
    )
    expect(eqCalls).toContainEqual(['stripe_customer_id', 'cus_9'])
    expect(eqCalls).toContainEqual(['stripe_subscription_id', 'sub_x'])
  })
})

describe('shouldApplySubscriptionSync', () => {
  it('applies when the row has no subscription yet', () => {
    expect(shouldApplySubscriptionSync(null, 'sub_new', 'active')).toBe(true)
  })

  it('applies when the event is for the subscription already on the row', () => {
    expect(shouldApplySubscriptionSync('sub_a', 'sub_a', 'past_due')).toBe(true)
    expect(shouldApplySubscriptionSync('sub_a', 'sub_a', 'cancelled')).toBe(true)
  })

  it('lets a DIFFERENT subscription claim the row when it grants access (resubscribe)', () => {
    expect(shouldApplySubscriptionSync('sub_old', 'sub_new', 'active')).toBe(true)
    expect(shouldApplySubscriptionSync('sub_old', 'sub_new', 'trialing')).toBe(true)
  })

  it('IGNORES a stale terminal event from a superseded subscription', () => {
    // The real hazard: cancelling an old subscription must not downgrade a school
    // whose current subscription is live and paid.
    expect(shouldApplySubscriptionSync('sub_live', 'sub_stale', 'cancelled')).toBe(false)
    expect(shouldApplySubscriptionSync('sub_live', 'sub_stale', 'past_due')).toBe(false)
    expect(shouldApplySubscriptionSync('sub_live', 'sub_stale', 'incomplete')).toBe(false)
  })
})
