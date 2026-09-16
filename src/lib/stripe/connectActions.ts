'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { getSchoolConnect } from './connect'

export type ConnectOnboardingState = { error?: string; url?: string } | null

/**
 * Starts (or resumes) Stripe Connect onboarding for the admin's school.
 *
 * Creates a Standard connected account for the school if it doesn't have one yet
 * (direct charges, no platform fee — the school is merchant of record), then
 * returns a Stripe-hosted Account Link to complete onboarding. On return, the
 * /admin/payments/connect page syncs the account's charges_enabled state (the
 * account.updated webhook also keeps it fresh).
 *
 * Security: admin-only; the connected account is tied to the admin's own school
 * via metadata and the stored id, never a client-supplied account.
 */
export async function startStripeConnectOnboardingAction(
  _prev: ConnectOnboardingState,
  _formData: FormData,
): Promise<ConnectOnboardingState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const adminClient = createSupabaseAdminClient()
  const stripe = getStripe()

  // Reuse the school's connected account if it already has one.
  const existing = await getSchoolConnect(admin.schoolId)
  let accountId = existing?.stripe_connect_account_id ?? null

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: 'standard',
        ...(admin.email ? { email: admin.email } : {}),
        ...(admin.schoolName ? { business_profile: { name: admin.schoolName } } : {}),
        metadata: { school_id: admin.schoolId },
      })
      accountId = account.id
    } catch (err) {
      logger.error('connect_account_create_failed', {
        schoolId: admin.schoolId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return {
        error:
          'Could not start Stripe setup. If this persists, Stripe Connect may not be enabled on the platform yet.',
      }
    }

    const { error: saveError } = await adminClient
      .from('schools')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', admin.schoolId)
    if (saveError) {
      logger.error('connect_account_save_failed', {
        schoolId: admin.schoolId,
        error: saveError.message,
      })
      return { error: 'Could not start Stripe setup. Please try again.' }
    }
  }

  const appUrl = serverEnv.appUrl
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/admin/payments/connect?state=refresh`,
      return_url: `${appUrl}/admin/payments/connect?state=return`,
      type: 'account_onboarding',
    })
    if (!link.url) return { error: 'Could not start Stripe setup. Please try again.' }
    return { url: link.url }
  } catch (err) {
    logger.error('connect_account_link_failed', {
      schoolId: admin.schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not start Stripe setup. Please try again.' }
  }
}
