import type Stripe from 'stripe'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { sendSubscriptionPaymentFailedEmail, sendSubscriptionEndedEmail } from './emails'
import { mapStatus, planForStatus } from './status'
import type { SubscriptionStatus } from '@/types/database'

/**
 * Configured €44.99 Pro+SMS price ids (empty until the live product exists). Read
 * from process.env directly rather than via serverEnv so importing this module in
 * tests doesn't trigger full env validation (buildSubscriptionSyncPayload is used
 * in unit tests).
 */
function smsTierPriceIds(): string[] {
  return [
    process.env['STRIPE_PRO_SMS_MONTHLY_PRICE_ID'],
    process.env['STRIPE_PRO_SMS_ANNUAL_PRICE_ID'],
  ].filter((v): v is string => Boolean(v))
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function schoolIdByCustomer(
  customerId: string,
  adminClient: AdminClient,
): Promise<string | null> {
  const { data } = await adminClient
    .from('subscriptions')
    .select('school_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return (data as { school_id: string } | null)?.school_id ?? null
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────
// Pure mappers (mapStatus, planForStatus) live in ./status — kept separate so the
// unit tests can import them without pulling in env/Stripe/DB side-effect modules.

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null
}

/**
 * current_period_end lived on the subscription in the 'acacia' API and moved to
 * items in later versions — read both defensively so we don't break across
 * Stripe API/type versions.
 */
export function getCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  const s = sub as unknown as {
    current_period_end?: number
    items?: { data?: { current_period_end?: number }[] }
  }
  return s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null
}

/** Resolve the subscription id an invoice belongs to, across API/type versions. */
export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null
    parent?: { subscription_details?: { subscription?: string | { id: string } } }
  }
  const s = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null
  return typeof s === 'string' ? s : (s?.id ?? null)
}

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id
}

/** The Stripe price ids on a subscription's line items. */
export function subscriptionPriceIds(sub: Stripe.Subscription): string[] {
  return (sub.items?.data ?? []).map((i) => i.price?.id).filter((id): id is string => Boolean(id))
}

/** The fields we sync from a Stripe subscription onto our `subscriptions` row. */
export interface SubscriptionSyncPayload {
  stripe_subscription_id: string
  stripe_customer_id: string
  plan: ReturnType<typeof planForStatus>
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_ends_at: string | null
  sms_enabled: boolean
}

/**
 * Pure mapping from a Stripe subscription to our row payload (no DB/school_id).
 * Extracted so the version-robust period/status/trial logic is unit-testable
 * without mocking Supabase or Stripe network calls.
 *
 * `smsPriceIds` are the configured €44.99 Pro+SMS price ids — a subscription on
 * one of them sets `sms_enabled`, the SMS entitlement. Passed in (not read from
 * env) to keep this function pure. Empty ⇒ no SMS tier configured ⇒ never enabled.
 */
export function buildSubscriptionSyncPayload(
  sub: Stripe.Subscription,
  smsPriceIds: readonly string[] = [],
): SubscriptionSyncPayload {
  const status = mapStatus(sub.status)
  const priceIds = subscriptionPriceIds(sub)
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerIdOf(sub),
    plan: planForStatus(status),
    status,
    current_period_end: toIso(getCurrentPeriodEnd(sub)),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    trial_ends_at: toIso(sub.trial_end),
    sms_enabled: smsPriceIds.length > 0 && priceIds.some((id) => smsPriceIds.includes(id)),
  }
}

/**
 * Stripe fires invoice.payment_failed on every dunning retry — only the first
 * transition into past_due should email the admin. Returns false when there is
 * no prior row, or it was already past_due/cancelled.
 */
export function shouldSendDunningEmail(
  priorStatus: SubscriptionStatus | null | undefined,
): boolean {
  return priorStatus != null && priorStatus !== 'past_due' && priorStatus !== 'cancelled'
}

/**
 * Whether an incoming `customer.subscription.*` event may overwrite the school's
 * row. Stripe keeps emitting events for SUPERSEDED subscriptions (a school that
 * lapsed and resubscribed holds more than one), and applying a stale terminal
 * event would revoke access from a school whose current subscription is live.
 *
 * - same subscription as the row, or the row has none yet → always apply
 * - a DIFFERENT subscription → only if it grants access (a resubscription);
 *   a cancelled/past_due/incomplete event from an old subscription is ignored.
 */
export function shouldApplySubscriptionSync(
  currentSubId: string | null | undefined,
  incomingSubId: string,
  incomingStatus: SubscriptionStatus,
): boolean {
  if (!currentSubId || currentSubId === incomingSubId) return true
  return incomingStatus === 'active' || incomingStatus === 'trialing'
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * customer.subscription.created / updated — upsert the school's subscription row
 * from Stripe (the source of truth). Resolves the tenant from the subscription's
 * `school_id` metadata (set at checkout), falling back to matching the existing
 * row by Stripe customer id.
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  adminClient: AdminClient,
): Promise<void> {
  const customerId = customerIdOf(sub)
  const schoolId = (sub.metadata?.school_id as string | undefined) ?? null
  const payload = buildSubscriptionSyncPayload(sub, smsTierPriceIds())
  const { status, plan } = payload

  if (schoolId) {
    // Guard against stale events. A school can hold several Stripe subscriptions
    // (it lapsed and resubscribed), and a superseded one still emits events —
    // e.g. `updated` with status=canceled when it is finally cancelled. Applying
    // that would overwrite the row and revoke access from a school whose current
    // subscription is live and paid. A NEW subscription that grants access may
    // still claim the row (that is a resubscription).
    const { data: existing } = await adminClient
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('school_id', schoolId)
      .maybeSingle()
    const currentSubId =
      (existing as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id ?? null

    if (!shouldApplySubscriptionSync(currentSubId, sub.id, status)) {
      logger.info('subscription_sync_skipped_stale', {
        schoolId,
        incomingSubId: sub.id,
        currentSubId,
        status,
      })
      return
    }

    const { error } = await adminClient
      .from('subscriptions')
      .upsert({ school_id: schoolId, ...payload }, { onConflict: 'school_id' })
    if (error) {
      logger.error('subscription_sync_upsert_failed', { schoolId, error: error.message })
      throw new Error(error.message)
    }
  } else {
    // No metadata (e.g. a subscription created outside our checkout) — match the
    // existing row by customer id. If none exists we cannot resolve the tenant.
    const { error } = await adminClient
      .from('subscriptions')
      .update(payload)
      .eq('stripe_customer_id', customerId)
    if (error) {
      logger.error('subscription_sync_update_failed', { customerId, error: error.message })
      throw new Error(error.message)
    }
  }

  logger.info('subscription_synced', { schoolId, status, plan, subId: sub.id })
}

/**
 * customer.subscription.deleted — the subscription has ended. Mark cancelled and
 * revert the plan to free so feature gating locks Pro features.
 *
 * Scoped to the subscription that is CURRENTLY on the row. A school can have more
 * than one Stripe subscription (e.g. it lapsed and resubscribed, so a superseded
 * one is cancelled later). Without the `stripe_subscription_id` guard, that stale
 * cancellation would revoke access from a school whose newer subscription is still
 * active and paid. A non-matching delete is a no-op.
 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  adminClient: AdminClient,
): Promise<void> {
  const customerId = customerIdOf(sub)
  const schoolId = (sub.metadata?.school_id as string | undefined) ?? null
  const payload = {
    status: 'cancelled' as const,
    plan: 'free' as const,
    cancel_at_period_end: false,
    stripe_subscription_id: sub.id,
    sms_enabled: false,
  }

  const query = adminClient.from('subscriptions').update(payload)
  const scoped = schoolId
    ? query.eq('school_id', schoolId)
    : query.eq('stripe_customer_id', customerId)
  const { error } = await scoped.eq('stripe_subscription_id', sub.id)

  if (error) {
    logger.error('subscription_deleted_update_failed', {
      schoolId,
      customerId,
      error: error.message,
    })
    throw new Error(error.message)
  }
  logger.info('subscription_cancelled', { schoolId, subId: sub.id })

  // Dunning: notify the school admin their Pro subscription ended.
  const sid = schoolId ?? (await schoolIdByCustomer(customerId, adminClient))
  if (sid) await sendSubscriptionEndedEmail(sid, adminClient)
}

/**
 * invoice.payment_succeeded — a renewal (or first) payment cleared. Confirm the
 * subscription is active and refresh the period end. The authoritative period
 * also arrives via customer.subscription.updated; this keeps state fresh either way.
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  adminClient: AdminClient,
): Promise<void> {
  const subId = getInvoiceSubscriptionId(invoice)
  if (!subId) return // not a subscription invoice — ignore

  const periodEnd = invoice.lines?.data?.[0]?.period?.end ?? null
  const payload = {
    status: 'active' as const,
    plan: 'pro' as const,
    ...(periodEnd ? { current_period_end: toIso(periodEnd) } : {}),
  }

  // Never resurrect a cancelled subscription from a late/duplicate invoice event —
  // the authoritative end-of-life is customer.subscription.deleted.
  const { error } = await adminClient
    .from('subscriptions')
    .update(payload)
    .eq('stripe_subscription_id', subId)
    .neq('status', 'cancelled')
  if (error) {
    logger.error('subscription_invoice_paid_update_failed', { subId, error: error.message })
    throw new Error(error.message)
  }
  logger.info('subscription_invoice_paid', { subId })
}

/**
 * invoice.payment_failed — a renewal payment failed. Move to past_due so the
 * grace window (Phase 4) starts; Stripe will retry per the dunning settings.
 */
export async function handleInvoiceFailed(
  invoice: Stripe.Invoice,
  adminClient: AdminClient,
): Promise<void> {
  const subId = getInvoiceSubscriptionId(invoice)
  if (!subId) return

  // Read the prior state so we only send ONE dunning email — on the transition
  // into past_due. Stripe fires invoice.payment_failed on every dunning retry,
  // so emailing unconditionally would spam the admin.
  const { data: before } = await adminClient
    .from('subscriptions')
    .select('school_id, status')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()
  const prior = before as { school_id: string; status: SubscriptionStatus } | null

  const { error } = await adminClient
    .from('subscriptions')
    .update({ status: 'past_due' as const })
    .eq('stripe_subscription_id', subId)
    .neq('status', 'cancelled')
  if (error) {
    logger.error('subscription_invoice_failed_update_failed', { subId, error: error.message })
    throw new Error(error.message)
  }
  logger.info('subscription_invoice_failed', { subId })

  // Dunning email only on the first failure (status was not already past_due/cancelled).
  if (prior && shouldSendDunningEmail(prior.status)) {
    await sendSubscriptionPaymentFailedEmail(prior.school_id, adminClient)
  }
}
