'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto/secrets'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import type { AuditAction } from '@/types/database'
import { fundingEnabled } from './access'

export type RevealResult = { ok: true; value: string } | { ok: false; error: string }

const FIELDS = ['PPSN', 'CHICK'] as const
type SensitiveField = (typeof FIELDS)[number]

function isField(v: string): v is SensitiveField {
  return (FIELDS as readonly string[]).includes(v)
}

async function gate(): Promise<{ user: SessionUser; schoolId: string } | { error: string }> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!user.permissions.includes('funding.view_sensitive_identifiers'))
    return { error: 'You do not have permission to reveal sensitive identifiers.' }
  if (!(await fundingEnabled(user.schoolId)))
    return { error: 'The Funding & Hive Centre is not enabled for your crèche.' }
  return { user, schoolId: user.schoolId }
}

async function audit(
  user: SessionUser,
  schoolId: string,
  action: AuditAction,
  registrationId: string,
  field: SensitiveField,
): Promise<void> {
  const db = createSupabaseAdminClient()
  const { error } = await db.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: user.id,
    actor_email: user.email,
    action,
    resource_type: 'child_funding_registration',
    resource_id: registrationId,
    // Record WHICH identifier was revealed — never the value itself.
    metadata: { field },
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('sensitive_reveal_audit_failed', { action, error: error.message })
}

/**
 * Reveal one sensitive identifier (PPSN or CHICK) for a child funding registration.
 * Gated on funding.view_sensitive_identifiers + the tenant flag, school-scoped, and
 * every successful reveal writes an audit event (the WHICH, never the value). The value
 * is returned for transient display only — callers must not persist or log it.
 */
export async function revealIdentifierAction(input: {
  registrationId: string
  field: string
}): Promise<RevealResult> {
  const g = await gate()
  if ('error' in g) return { ok: false, error: g.error }
  if (!isField(input.field)) return { ok: false, error: 'Unknown identifier.' }

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('child_funding_registrations')
    .select('id, pps_number_encrypted, chick_code')
    .eq('id', input.registrationId)
    .eq('school_id', g.schoolId)
    .maybeSingle()
  const row = data as { pps_number_encrypted: string | null; chick_code: string | null } | null
  if (!row) return { ok: false, error: 'Registration not found.' }

  if (input.field === 'PPSN') {
    if (!row.pps_number_encrypted) return { ok: false, error: 'No PPSN on file.' }
    let value: string
    try {
      value = decryptSecret(row.pps_number_encrypted)
    } catch (err) {
      logger.error('ppsn_decrypt_failed', {
        schoolId: g.schoolId,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return { ok: false, error: 'Could not decrypt the PPSN.' }
    }
    await audit(g.user, g.schoolId, 'funding.ppsn_revealed', input.registrationId, 'PPSN')
    return { ok: true, value }
  }

  // CHICK
  if (!row.chick_code) return { ok: false, error: 'No CHICK on file.' }
  await audit(g.user, g.schoolId, 'funding.chick_revealed', input.registrationId, 'CHICK')
  return { ok: true, value: row.chick_code }
}
