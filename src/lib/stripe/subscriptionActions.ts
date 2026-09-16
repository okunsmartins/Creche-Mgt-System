'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'
import { hasProAccess, tierSwitchMode } from '@/lib/subscriptions/access'
import type { SubscriptionRow } from '@/types/database'

export type SubscriptionCheckoutState = {
  error?: string
  url?: string
  /** Set when an in-place upgrade completed without a redirect (tier switch). */
  success?: boolean
} | null

type AdminUser = Awaited<ReturnType<typeof requireAdmin>>
type AdminClient = ReturnType<typeof createSupabaseAdminClient>

const SUB_SELECT =
  'id, stripe_customer_id, stripe_subscription_id, status, plan, trial_ends_at, current_period_end, sms_enabled'

type SubLite = Pick<
  SubscriptionRow,
  | 'id'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'status'
  | 'plan'
  | 'trial_ends_at'
  | 'current_period_end'
  | 'sms_enabled'
> | null

/** Configured plain-Pro price ids (€39.99 tier). Empty until the product exists. */
function proPriceIds(): string[] {
  return [serverEnv.stripeProMonthlyPriceId, serverEnv.stripeProAnnualPriceId].filter(
    (p): p is string => !!p,
  )
}

/** Configured €44.99 Pro + SMS price ids. Empty until the product exists. */
function smsPriceIds(): string[] {
  return [serverEnv.stripeProSmsMonthlyPriceId, serverEnv.stripeProSmsAnnualPriceId].filter(
    (p): p is string => !!p,
  )
}

async function loadSchoolSub(adminClient: AdminClient, schoolId: string): Promise<SubLite> {
  const { data } = await adminClient
    .from('subscriptions')
    .select(SUB_SELECT)
    .eq('school_id', schoolId)
    .maybeSingle()
  return (data as SubLite) ?? null
}

/**
 * Create/reuse the school's Stripe customer, persist it on the subscription row,
 * and open a Checkout session for `priceId`. Shared by the plain-Pro subscribe and
 * the Pro + SMS tier switch's fresh-subscribe fallback.
 *
 * The authoritative subscription state (plan, status, `sms_enabled`) is set later
 * by the webhook from the price on the completed subscription — a browser redirect
 * to success is never treated as confirmation.
 */
async function beginCheckoutForPrice(
  admin: AdminUser,
  sub: SubLite,
  priceId: string,
): Promise<SubscriptionCheckoutState> {
  const schoolId = admin.schoolId!
  const adminClient = createSupabaseAdminClient()
  const stripe = getStripe()

  // Once-per-school trial. Only grant a Checkout trial if the school has neither
  //  - had a real subscription before (no stripe_subscription_id ever set), nor
  //  - already used its signup trial (trial_ends_at is set at provisioning).
  // Without the second condition a new school would stack two trials.
  const grantTrial = !sub?.stripe_subscription_id && !sub?.trial_ends_at

  // Idempotently get/create the Stripe customer for this school.
  let customerId = sub?.stripe_customer_id ?? null
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        ...(admin.email ? { email: admin.email } : {}),
        ...(admin.schoolName ? { name: admin.schoolName } : {}),
        metadata: { school_id: schoolId },
      })
      customerId = customer.id
    } catch (err) {
      logger.error('subscription_customer_create_failed', {
        schoolId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return { error: 'Could not start checkout. Please try again.' }
    }
  }

  // Persist the customer id on the school's subscription row (create row if needed).
  if (sub) {
    await adminClient
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('id', sub.id)
  } else {
    const { error: insertError } = await adminClient.from('subscriptions').insert({
      school_id: schoolId,
      stripe_customer_id: customerId,
      plan: 'free',
      status: 'incomplete',
    })
    if (insertError) {
      logger.error('subscription_row_insert_failed', { schoolId, error: insertError.message })
      // Non-fatal: checkout can still proceed; the webhook upserts by school_id.
    }
  }

  const appUrl = serverEnv.appUrl
  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing/cancel`,
      // school_id on BOTH the session and the subscription object so the webhook
      // can resolve the tenant from customer.subscription.* events too.
      metadata: { school_id: schoolId },
      subscription_data: {
        metadata: { school_id: schoolId },
        ...(grantTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
      },
    })
  } catch (err) {
    logger.error('subscription_checkout_create_failed', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not start checkout. Please try again.' }
  }

  if (!session.url) {
    logger.error('subscription_checkout_no_url', { schoolId })
    return { error: 'Could not start checkout. Please try again.' }
  }

  return { url: session.url }
}

/**
 * Starts a Stripe Checkout session for a school to subscribe to a paid plan (plain
 * Pro or the Pro + SMS tier).
 *
 * Security:
 *  - requireAdmin() — only an admin of a school may subscribe it.
 *  - The price ID is validated against the configured Pro / Pro+SMS prices; an
 *    arbitrary client-supplied price is rejected (never trust client pricing).
 *  - The Stripe customer is created/reused idempotently per school.
 *  - Authoritative state is set later by the webhook, not the browser redirect.
 */
export async function createSubscriptionCheckoutAction(
  _prev: SubscriptionCheckoutState,
  formData: FormData,
): Promise<SubscriptionCheckoutState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  // Any configured plan price is allowed (Pro or Pro + SMS) — reject anything else.
  const allowedPrices = [...proPriceIds(), ...smsPriceIds()]
  const priceId = formData.get('priceId')
  if (allowedPrices.length === 0) {
    return { error: 'Subscriptions are not available yet. Please try again later.' }
  }
  if (typeof priceId !== 'string' || !allowedPrices.includes(priceId)) {
    return { error: 'Invalid plan selected.' }
  }

  const adminClient = createSupabaseAdminClient()
  const sub = await loadSchoolSub(adminClient, admin.schoolId)

  // Already on a plan that still grants access — don't start a second checkout
  // (the tier switch / billing portal handle changes). Uses hasProAccess, NOT the
  // raw status: a school whose signup trial has EXPIRED still has status='trialing'
  // and must be able to subscribe — checking status alone would lock it out.
  if (sub && hasProAccess(sub)) {
    return { error: 'Your school already has an active subscription.' }
  }

  return beginCheckoutForPrice(admin, sub, priceId)
}

/**
 * Move a school onto the €44.99 Pro + SMS tier.
 *
 * - A school with a LIVE Stripe subscription is upgraded IN PLACE: the line item's
 *   price is swapped to the SMS price with proration, so there is no second
 *   subscription and no re-entering card details. `sms_enabled` is set optimistically
 *   (the price is now confirmed on Stripe) for instant activation; the webhook
 *   remains the source of truth and reconfirms it.
 * - A school with no live Stripe subscription (free/lapsed, or a local signup trial)
 *   is sent through a fresh Checkout for the SMS price.
 *
 * Security mirrors createSubscriptionCheckoutAction: admin-only, price validated
 * against the configured SMS prices, never trusting a client-supplied amount.
 */
export async function switchToProSmsAction(
  _prev: SubscriptionCheckoutState,
  formData: FormData,
): Promise<SubscriptionCheckoutState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const allowedSms = smsPriceIds()
  const priceId = formData.get('priceId')
  if (allowedSms.length === 0) {
    return { error: 'The Pro + SMS plan is not available yet. Please try again later.' }
  }
  if (typeof priceId !== 'string' || !allowedSms.includes(priceId)) {
    return { error: 'Invalid plan selected.' }
  }

  const adminClient = createSupabaseAdminClient()
  const sub = await loadSchoolSub(adminClient, admin.schoolId)
  const mode = tierSwitchMode(sub, hasProAccess(sub))

  if (mode === 'already_on_sms') {
    return { error: 'Your school is already on the Pro + SMS plan.' }
  }

  if (mode === 'checkout') {
    return beginCheckoutForPrice(admin, sub, priceId)
  }

  // mode === 'modify' — upgrade the live subscription in place.
  const subscriptionId = sub!.stripe_subscription_id!
  const stripe = getStripe()
  try {
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId = stripeSub.items.data[0]?.id
    if (!itemId) {
      logger.error('tier_switch_no_item', { schoolId: admin.schoolId, subscriptionId })
      return { error: 'Could not update your plan. Please try again.' }
    }

    // Already on this price on Stripe? Just make sure the entitlement is set.
    const alreadyOnSmsPrice = stripeSub.items.data.some(
      (i) => i.price?.id && allowedSms.includes(i.price.id),
    )
    if (!alreadyOnSmsPrice) {
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { school_id: admin.schoolId },
      })
    }
  } catch (err) {
    logger.error('tier_switch_update_failed', {
      schoolId: admin.schoolId,
      subscriptionId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not update your plan. Please try again.' }
  }

  // Optimistically enable SMS now — the price change is confirmed on Stripe, and
  // customer.subscription.updated will reconfirm sms_enabled from the price.
  const { error: flagError } = await adminClient
    .from('subscriptions')
    .update({ sms_enabled: true })
    .eq('school_id', admin.schoolId)
  if (flagError) {
    logger.error('tier_switch_flag_failed', { schoolId: admin.schoolId, error: flagError.message })
    // Non-fatal: the webhook will still set sms_enabled from the price.
  }

  logger.info('tier_switched_to_pro_sms', { schoolId: admin.schoolId, subscriptionId })
  return { success: true }
}

export type BillingPortalState = {
  error?: string
  url?: string
} | null

/**
 * Opens the Stripe-hosted billing portal so an admin can manage their school's
 * subscription (update card, cancel, view invoices). Requires the school to have
 * a Stripe customer (created at checkout).
 *
 * Note: the billing portal must be activated once in the Stripe Dashboard
 * (Settings → Billing → Customer portal) or this call errors.
 */
export async function createBillingPortalAction(
  _prev: BillingPortalState,
  _formData: FormData,
): Promise<BillingPortalState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return { error: 'No billing account yet. Subscribe to a plan first.' }
  }

  const stripe = getStripe()
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${serverEnv.appUrl}/admin/subscription`,
    })
    return { url: session.url }
  } catch (err) {
    logger.error('billing_portal_create_failed', {
      schoolId: admin.schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not open the billing portal. Please try again.' }
  }
}
