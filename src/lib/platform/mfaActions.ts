'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { createCorrelationId } from '@/lib/utils'

export type MfaResetState = { error?: string; success?: boolean }

/**
 * Platform owner removes an admin's authenticator (lost / replaced phone). They then
 * set it up again at their next sign-in. The grace period is NOT restarted, so if it
 * has passed they go straight to set-up. Owner-only; audited.
 */
export async function resetAdminMfaAction(userId: string): Promise<MfaResetState> {
  const owner = await requireAuth() // the owner must have passed two-step sign-in too
  if (!isPlatformOwner(owner)) return { error: 'Not authorized.' }
  if (!userId) return { error: 'Admin not found.' }

  const db = createSupabaseAdminClient()
  const { data, error } = await db.auth.admin.mfa.listFactors({ userId })
  if (error) {
    logger.error('platform_mfa_list_failed', { userId, error: error.message })
    return { error: 'Could not read this account. Please try again.' }
  }
  const factors = data?.factors ?? []
  for (const f of factors) {
    const { error: delErr } = await db.auth.admin.mfa.deleteFactor({ id: f.id, userId })
    if (delErr) {
      logger.error('platform_mfa_delete_failed', { userId, error: delErr.message })
      return { error: 'Could not reset two-step sign-in. Please try again.' }
    }
  }

  const { data: prof } = await db
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  await db.from('audit_logs').insert({
    school_id: (prof as { school_id: string | null } | null)?.school_id ?? null,
    actor_id: owner.id,
    actor_email: owner.email,
    action: 'auth.mfa_reset',
    resource_type: 'user',
    resource_id: userId,
    metadata: { factors_removed: factors.length },
    correlation_id: createCorrelationId(),
  }) // best-effort: needs migration 111 for the action name
  logger.info('platform_mfa_reset', { userId, factorsRemoved: factors.length })
  revalidatePath('/platform/security')
  return { success: true }
}
