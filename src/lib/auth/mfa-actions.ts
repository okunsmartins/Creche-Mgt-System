'use server'

// Two-step sign-in (TOTP) for privileged accounts: set-up and the per-sign-in code.
// Supabase stores the authenticator factor; a correct code upgrades the session to
// assurance level aal2, which the guards require (see mfa-policy.ts).

import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { createCorrelationId } from '@/lib/utils'
import type { SessionUser } from '@/types'
import { requireAuthForMfa } from './guards'
import { normaliseTotpCode } from './mfa-policy'
import { safeNextPath } from './confirm-link'
import { privilegedHomeFor } from './landing'

export type MfaEnrollState =
  | null
  | { error: string }
  | { factorId: string; qrCode: string; secret: string }

export type MfaCodeState = null | { error: string }

const WRONG_CODE =
  "That code didn't work. Use the newest code from your authenticator app, and check your phone's clock is set automatically."

/** Where a privileged user goes once two-step sign-in is satisfied. */
const homeFor = (user: SessionUser): string => privilegedHomeFor(user)

/** Begin set-up: create a new (unverified) authenticator factor and return its QR code. */
export async function startMfaEnrollmentAction(): Promise<MfaEnrollState> {
  const user = await requireAuthForMfa()
  if (!user.mfa) return { error: 'Two-step sign-in is only needed for admin accounts.' }
  if (user.mfa.nextLevel === 'aal2')
    return { error: 'Two-step sign-in is already set up on this account.' }

  const supabase = await createSupabaseServerClient()
  // Clear half-finished attempts (e.g. the page was closed before confirming).
  const { data: existing } = await supabase.auth.mfa.listFactors()
  for (const f of existing?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified')
      await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Creche Wise',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
  })
  if (error || !data) {
    logger.warn('mfa_enroll_failed', { reason: error?.code ?? 'no_data' })
    return { error: 'Could not start set-up. Please try again.' }
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Finish set-up: the first code from the app proves it's linked, and signs this session in at aal2. */
export async function confirmMfaEnrollmentAction(
  _prev: MfaCodeState,
  formData: FormData,
): Promise<MfaCodeState> {
  const user = await requireAuthForMfa()
  if (!user.mfa) return { error: 'Two-step sign-in is only needed for admin accounts.' }
  const factorId = String(formData.get('factorId') ?? '')
  const code = normaliseTotpCode(formData.get('code'))
  if (!factorId) return { error: 'Start set-up again.' }
  if (!code) return { error: 'Enter the 6-digit code from your authenticator app.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) {
    logger.warn('mfa_enroll_verify_failed', { reason: error.code })
    return { error: WRONG_CODE }
  }

  const db = createSupabaseAdminClient()
  await db.from('audit_logs').insert({
    school_id: user.schoolId,
    actor_id: user.id,
    actor_email: user.email,
    action: 'auth.mfa_enrolled',
    resource_type: 'user',
    resource_id: user.id,
    metadata: { factor_type: 'totp' },
    correlation_id: createCorrelationId(),
  }) // best-effort: needs migration 111 for the action name
  logger.info('mfa_enrolled', {})
  redirect(homeFor(user))
}

/** Every sign-in: enter the current 6-digit code to reach admin pages. */
export async function verifyMfaAction(
  _prev: MfaCodeState,
  formData: FormData,
): Promise<MfaCodeState> {
  const user = await requireAuthForMfa()
  if (!user.mfa) redirect('/')
  const code = normaliseTotpCode(formData.get('code'))
  if (!code) return { error: 'Enter the 6-digit code from your authenticator app.' }

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const factor = (data?.totp ?? []).find((f) => f.status === 'verified')
  if (!factor) redirect('/mfa/setup')

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
  if (error) {
    logger.warn('mfa_verify_failed', { reason: error.code })
    return { error: WRONG_CODE }
  }
  logger.info('mfa_verified', {})
  // Same-site paths only (e.g. back to /reset-password); otherwise their dashboard.
  const next = formData.get('next')
  redirect(typeof next === 'string' && next ? safeNextPath(next, homeFor(user)) : homeFor(user))
}
