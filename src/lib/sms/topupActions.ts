'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { getStripe } from '@/lib/stripe/client'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { getSmsTopupBundle } from './topup'

export type SmsTopupResult = { url: string } | { error: string }

/**
 * Start a Stripe one-off checkout for an SMS credit bundle. Admin-only. The
 * webhook (`checkout.session.completed` with `metadata.type = 'sms_topup'`)
 * credits the school on payment. Returns the checkout URL for the client to
 * redirect to.
 */
export async function createSmsTopupCheckout(bundleId: string): Promise<SmsTopupResult> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const bundle = getSmsTopupBundle(bundleId)
  if (!bundle) return { error: 'Unknown top-up option.' }

  const appUrl = serverEnv.appUrl
  const stripe = getStripe()

  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `SMS credits — ${bundle.credits} texts` },
            unit_amount: bundle.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/admin/sms?topup=success`,
      cancel_url: `${appUrl}/admin/sms?topup=cancelled`,
      // The webhook resolves the tenant + credits from this metadata.
      metadata: {
        type: 'sms_topup',
        school_id: admin.schoolId,
        credits: String(bundle.credits),
      },
    })
  } catch (err) {
    logger.error('sms_topup_checkout_create_failed', {
      schoolId: admin.schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Could not start checkout. Please try again.' }
  }

  if (!session.url) {
    logger.error('sms_topup_checkout_no_url', { schoolId: admin.schoolId })
    return { error: 'Could not start checkout. Please try again.' }
  }
  return { url: session.url }
}
