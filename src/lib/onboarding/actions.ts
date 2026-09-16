'use server'

import { randomBytes } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { isValidEmail, normalizeEmail } from './validate'
import { sendPortalVerificationEmail } from './emails'

export type RequestPortalState = { error?: string; success?: boolean }

/**
 * Public "request your portal" lead capture. Stores (or refreshes) the lead with
 * a fresh one-time token and emails the confirmation link. Anonymous — no auth.
 * Existing verification is preserved on a re-request.
 */
export async function requestPortalSignupAction(
  _prev: RequestPortalState,
  formData: FormData,
): Promise<RequestPortalState> {
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim()
  if (!isValidEmail(rawEmail)) return { error: 'Please enter a valid email address.' }
  const email = normalizeEmail(rawEmail)
  const contactName = ((formData.get('contactName') as string | null) ?? '').trim().slice(0, 120)
  const schoolName = ((formData.get('schoolName') as string | null) ?? '').trim().slice(0, 160)
  const token = randomBytes(32).toString('hex')

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('portal_signups').upsert(
    {
      email,
      contact_name: contactName || null,
      school_name: schoolName || null,
      token,
      requested_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  )
  if (error) {
    logger.error('portal_signup_upsert_failed', { error: error.message })
    return { error: 'Something went wrong. Please try again.' }
  }

  const sent = await sendPortalVerificationEmail(email, token, contactName || null)
  if (!sent) {
    return {
      error: "We couldn't send the confirmation email. Please check the address and try again.",
    }
  }

  logger.info('portal_signup_requested', {})
  return { success: true }
}
