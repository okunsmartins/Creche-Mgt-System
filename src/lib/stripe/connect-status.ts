import type { SchoolRow } from '@/types/database'

/**
 * Pure Stripe Connect status derivation — no I/O, no server-only imports, so it
 * is trivially unit-testable (mirrors the pure/impure split used elsewhere, e.g.
 * subscriptions/status.ts vs webhookHandlers.ts).
 */

export type ConnectStatus = 'not_started' | 'pending' | 'active'

export type SchoolConnectFields = Pick<
  SchoolRow,
  | 'stripe_connect_account_id'
  | 'stripe_connect_charges_enabled'
  | 'stripe_connect_details_submitted'
>

/**
 *  - no account id            → not_started
 *  - account exists, can't charge yet (onboarding incomplete) → pending
 *  - charges enabled          → active (ready to take parent payments)
 */
export function connectStatus(account: SchoolConnectFields | null): ConnectStatus {
  if (!account?.stripe_connect_account_id) return 'not_started'
  if (account.stripe_connect_charges_enabled) return 'active'
  return 'pending'
}
