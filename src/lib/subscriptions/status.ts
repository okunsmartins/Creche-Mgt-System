import type Stripe from 'stripe'
import type { SubscriptionStatus, SubscriptionPlan } from '@/types/database'

// Pure mapping helpers for subscription state. Kept free of any side-effecting
// imports (env, Stripe client, DB) so they are trivially unit-testable.

/** Map a Stripe subscription status onto our enum. */
export function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled'
    case 'incomplete':
      return 'incomplete'
    default:
      return 'incomplete'
  }
}

/**
 * Single paid tier (Pro). Entitlement tracks status: a subscription that is
 * active/trialing/past_due grants Pro; anything else is effectively free.
 * (Phase 4 gating reads plan + status; past_due still gets the grace window.)
 */
export function planForStatus(status: SubscriptionStatus): SubscriptionPlan {
  return status === 'active' || status === 'trialing' || status === 'past_due' ? 'pro' : 'free'
}
