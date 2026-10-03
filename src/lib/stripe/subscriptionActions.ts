'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'
import { hasProAccess } from '@/lib/subscriptions/access'
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

/**
 * Configured price ids for the single Creche Wise plan (monthly + annual). Empty
 * until the product exists in Stripe. SMS and every other feature are included.
 */
function proPriceIds(): string[] {
  return [serverEnv.stripeProMonthlyPriceId, serverEnv.stripeProAnnualPriceId].filter(
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
 * Starts a Stripe Checkout session for a school to subscribe to the Creche Wise plan
 * (monthly or annual — both unlock every feature, SMS included).
 *
 * Security:
 *  - requireAdmin() — only an admin of a school may subscribe it.
 *  - The price ID is validated against the configured plan prices; an arbitrary
 *    client-supplied price is rejected (never trust client pricing).
 *  - The Stripe customer is created/reused idempotently per school.
 *  - Authoritative state is set later by the webhook, not the browser redirect.
 */
export async function createSubscriptionCheckoutAction(
  _prev: SubscriptionCheckoutState,
  formData: FormData,
): Promise<SubscriptionCheckoutState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  // Only the configured plan prices (monthly/annual) are allowed — reject anything else.
  const allowedPrices = proPriceIds()
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
