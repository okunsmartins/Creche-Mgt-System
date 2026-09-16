import 'server-only'
import { getStripe } from '@/lib/stripe/client'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { connectStatus, type ConnectStatus, type SchoolConnectFields } from './connect-status'

/**
 * Per-school Stripe Connect (Standard account, direct charges, no platform fee).
 * The school is merchant of record; parent payments land directly with them and
 * they handle their own refunds/disputes. Pure status derivation lives in
 * ./connect-status; this module adds the DB/Stripe I/O.
 */

export { connectStatus }
export type { ConnectStatus, SchoolConnectFields }

const CONNECT_SELECT =
  'stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_details_submitted'

/** Load a school's stored Connect fields. */
export async function getSchoolConnect(schoolId: string): Promise<SchoolConnectFields | null> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('schools')
    .select(CONNECT_SELECT)
    .eq('id', schoolId)
    .maybeSingle()
  return (data as SchoolConnectFields | null) ?? null
}

/** True when the school can accept Stripe parent payments right now. */
export async function schoolCanCollectStripe(schoolId: string): Promise<boolean> {
  return connectStatus(await getSchoolConnect(schoolId)) === 'active'
}

/**
 * Pull the latest state from Stripe for the school's connected account and
 * persist charges_enabled / details_submitted. Called when the admin returns
 * from onboarding (the webhook also keeps this fresh via account.updated).
 * Returns the resulting status; falls back to stored state on error.
 */
export async function syncSchoolConnectFromStripe(schoolId: string): Promise<ConnectStatus> {
  const current = await getSchoolConnect(schoolId)
  if (!current?.stripe_connect_account_id) return 'not_started'
  try {
    const account = await getStripe().accounts.retrieve(current.stripe_connect_account_id)
    const adminClient = createSupabaseAdminClient()
    await adminClient
      .from('schools')
      .update({
        stripe_connect_charges_enabled: account.charges_enabled ?? false,
        stripe_connect_details_submitted: account.details_submitted ?? false,
      })
      .eq('id', schoolId)
    return account.charges_enabled ? 'active' : 'pending'
  } catch (err) {
    logger.error('connect_status_sync_failed', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return connectStatus(current)
  }
}
