import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { normalizeEmail } from './validate'

export interface PortalSignupView {
  id: string
  email: string
  contactName: string | null
  schoolName: string | null
  verified: boolean
  verifiedAt: string | null
  requestedAt: string
}

/** All portal sign-up leads, newest first — for the owner console. */
export async function listPortalSignups(): Promise<PortalSignupView[]> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('portal_signups')
    .select('id, email, contact_name, school_name, verified_at, requested_at')
    .order('requested_at', { ascending: false })
  type Row = {
    id: string
    email: string
    contact_name: string | null
    school_name: string | null
    verified_at: string | null
    requested_at: string
  }
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    contactName: r.contact_name,
    schoolName: r.school_name,
    verified: r.verified_at !== null,
    verifiedAt: r.verified_at,
    requestedAt: r.requested_at,
  }))
}

/** Whether this email has a confirmed portal sign-up (gates onboarding). */
export async function hasVerifiedSignup(email: string): Promise<boolean> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('portal_signups')
    .select('id')
    .eq('email', normalizeEmail(email))
    .not('verified_at', 'is', null)
    .maybeSingle()
  return !!data
}

export type VerifyResult = 'verified' | 'already' | 'not_found'

/**
 * Confirm a sign-up from its one-time token. Idempotent: an already-confirmed
 * token returns `already` (not an error), an unknown token returns `not_found`.
 */
export async function verifyPortalSignupByToken(
  token: string,
): Promise<{ result: VerifyResult; email: string | null }> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('portal_signups')
    .select('id, email, verified_at')
    .eq('token', token)
    .maybeSingle()
  const row = data as { id: string; email: string; verified_at: string | null } | null
  if (!row) return { result: 'not_found', email: null }
  if (row.verified_at) return { result: 'already', email: row.email }

  const { error } = await adminClient
    .from('portal_signups')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', row.id)
  if (error) {
    logger.error('portal_signup_verify_failed', { error: error.message })
    return { result: 'not_found', email: row.email }
  }
  return { result: 'verified', email: row.email }
}
