import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SubscriptionRow } from '@/types/database'

/** Premium features gated behind a paid (Pro) subscription. */
export type GatedFeature =
  | 'payment_links'
  | 'instalment_payments'
  | 'csv_import'
  | 'advanced_reports'

const PRO_FEATURES: ReadonlySet<GatedFeature> = new Set<GatedFeature>([
  'payment_links',
  'instalment_payments',
  'csv_import',
  'advanced_reports',
])

/** Grace window after a failed renewal before Pro features lock (hybrid model). */
export const PAST_DUE_GRACE_DAYS = 7

type AccessFields = Pick<
  SubscriptionRow,
  'plan' | 'status' | 'current_period_end' | 'trial_ends_at'
>

/**
 * Whether a school currently has Pro access. Computed from **plan + status**, not
 * row existence (a checkout-created row may exist with plan='free'/status='incomplete').
 *
 * - active / trialing  → yes
 * - past_due           → yes only within PAST_DUE_GRACE_DAYS after the period end
 * - cancelled / incomplete / free / no row → no
 *
 * `cancel_at_period_end = true` needs no special case: Stripe keeps status 'active'
 * until the period end, then emits subscription.deleted.
 */
export function hasProAccess(sub: AccessFields | null, now: Date = new Date()): boolean {
  if (!sub) return false
  if (sub.plan === 'free') return false

  switch (sub.status) {
    case 'active':
      return true
    case 'trialing':
      // Local trials carry an explicit end date; once it passes without a
      // conversion to 'active', access ends (drives the trial-then-subscribe
      // lock). Stripe-managed trials flip status before this matters, so this
      // is a safe superset.
      return !sub.trial_ends_at || now.getTime() <= new Date(sub.trial_ends_at).getTime()
    case 'past_due': {
      // Anchor the grace window on the renewal due date (period end). If unknown,
      // don't lock prematurely.
      if (!sub.current_period_end) return true
      const graceEndMs =
        new Date(sub.current_period_end).getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
      return now.getTime() <= graceEndMs
    }
    default:
      // cancelled, incomplete
      return false
  }
}

/** Pure feature check. All currently-gated features are Pro-tier. */
export function isFeatureAvailable(
  feature: GatedFeature,
  sub: AccessFields | null,
  now: Date = new Date(),
): boolean {
  if (!PRO_FEATURES.has(feature)) return true
  return hasProAccess(sub, now)
}

/**
 * Whether a school may use SMS. SMS is included with the single Creche Wise plan,
 * so SMS access is simply current plan access — any school with Pro access (active,
 * trialing, or in the past-due grace window) can send texts. (A per-school monthly
 * allowance + top-up credits still meter volume; see `lib/sms/balance.ts`.) Pure —
 * testable without I/O.
 */
export function hasSmsAccess(sub: AccessFields | null, now: Date = new Date()): boolean {
  return hasProAccess(sub, now)
}

/** Fetch a school's subscription row (or null = treat as free). */
export async function getSchoolSubscription(schoolId: string): Promise<SubscriptionRow | null> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()
  return (data as SubscriptionRow | null) ?? null
}

/** Convenience for pages: does this school have Pro access right now? */
export async function schoolHasProAccess(schoolId: string): Promise<boolean> {
  return hasProAccess(await getSchoolSubscription(schoolId))
}

/** Convenience for pages/actions: does this school have the SMS (Pro+SMS) tier? */
export async function schoolHasSmsAccess(schoolId: string): Promise<boolean> {
  return hasSmsAccess(await getSchoolSubscription(schoolId))
}

/**
 * Action/page guard: redirect to pricing if the school can't use `feature`.
 * Use on **action attempts** (and pages you want to hard-block). For pages that
 * should stay viewable with an inline upgrade prompt, use `schoolHasProAccess`
 * instead and render the locked state.
 */
export async function requireFeature(feature: GatedFeature, schoolId: string): Promise<void> {
  const sub = await getSchoolSubscription(schoolId)
  if (!isFeatureAvailable(feature, sub)) {
    redirect(`/pricing?locked=${feature}`)
  }
}

/**
 * App-wide gate: after the free trial (TRIAL_PERIOD_DAYS) or a lapsed subscription, a school
 * must be on an active Pro plan to keep using the portal. Call from the authed
 * layouts (admin/teacher/parent) — redirects the whole school to the pricing
 * page to subscribe. A missing schoolId is left to the role guards (not locked).
 */
export async function requireSchoolAccessOrRedirect(
  schoolId: string | null | undefined,
): Promise<void> {
  if (!schoolId) return
  const sub = await getSchoolSubscription(schoolId)
  if (hasProAccess(sub)) return

  // A brand-new school that has never subscribed (card-at-signup not completed:
  // no Stripe subscription and no local trial marker) is prompted to START a
  // trial, not told one "ended". A school that previously had one → re-subscribe.
  // Both go to the public /pricing page, so this stays loop-safe for non-admins.
  const neverSubscribed = !sub?.stripe_subscription_id && !sub?.trial_ends_at
  redirect(neverSubscribed ? '/pricing?reason=start_trial' : '/pricing?reason=trial_ended')
}
