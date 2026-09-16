import type Stripe from 'stripe'
import type { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { SMS_CREDIT_EXPIRY_MONTHS } from './topup'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/** True when a checkout session is an SMS credit top-up (vs an order payment). */
export function isSmsTopupSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.type === 'sms_topup'
}

/**
 * Credit a paid SMS top-up to the school's balance and refresh the 12-month
 * credit expiry. Idempotent: a `sms_topups` row keyed on the Stripe session id is
 * inserted first — a duplicate (23505) means it was already applied, so we skip
 * the (additive, non-idempotent) credit-add. Never adds credits without first
 * claiming the session.
 */
export async function applySmsTopup(
  session: Stripe.Checkout.Session,
  adminClient: AdminClient,
): Promise<void> {
  if (session.payment_status !== 'paid') {
    logger.info('sms_topup_not_paid', { sessionId: session.id, status: session.payment_status })
    return
  }
  if (session.currency?.toLowerCase() !== 'eur') {
    logger.error('sms_topup_wrong_currency', { sessionId: session.id, currency: session.currency })
    throw new Error(`SMS top-up expected EUR, got ${session.currency ?? 'null'}`)
  }

  const schoolId = session.metadata?.school_id
  const credits = Number(session.metadata?.credits ?? '0')
  if (!schoolId || !Number.isFinite(credits) || credits <= 0) {
    logger.error('sms_topup_bad_metadata', { sessionId: session.id })
    return
  }
  const amountCents = session.amount_total ?? 0

  // Claim the session first (idempotency key). If it already exists, skip.
  const { error: claimError } = await adminClient.from('sms_topups').insert({
    school_id: schoolId,
    provider_session_id: session.id,
    credits,
    amount_cents: amountCents,
  })
  if (claimError) {
    if (claimError.code === '23505') {
      logger.info('sms_topup_duplicate', { sessionId: session.id })
      return
    }
    logger.error('sms_topup_claim_failed', { sessionId: session.id, error: claimError.message })
    throw new Error(claimError.message)
  }

  const expireAt = new Date()
  expireAt.setMonth(expireAt.getMonth() + SMS_CREDIT_EXPIRY_MONTHS)

  const { data } = await adminClient
    .from('school_sms_balance')
    .select('credits')
    .eq('school_id', schoolId)
    .maybeSingle()
  const current = (data as { credits: number } | null)?.credits ?? null

  const creditError =
    current === null
      ? (
          await adminClient.from('school_sms_balance').insert({
            school_id: schoolId,
            credits,
            credits_expire_at: expireAt.toISOString(),
          })
        ).error
      : (
          await adminClient
            .from('school_sms_balance')
            .update({ credits: current + credits, credits_expire_at: expireAt.toISOString() })
            .eq('school_id', schoolId)
        ).error

  if (creditError) {
    // The claim succeeded but crediting failed — roll back the claim so Stripe's
    // retry can re-apply cleanly (otherwise the school paid but got no credits and
    // the duplicate check would skip forever). Then throw → 500 → Stripe retries.
    await adminClient.from('sms_topups').delete().eq('provider_session_id', session.id)
    logger.error('sms_topup_credit_failed', {
      schoolId,
      sessionId: session.id,
      error: creditError.message,
    })
    throw new Error(creditError.message)
  }

  logger.info('sms_topup_applied', { schoolId, credits, sessionId: session.id })
}
