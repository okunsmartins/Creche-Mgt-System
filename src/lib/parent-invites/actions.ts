'use server'

import { randomBytes } from 'node:crypto'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

export type InviteResult = { ok: true; url: string } | { ok: false; error: string }

/** How long a generated invite stays valid. */
const INVITE_TTL_DAYS = 14

/**
 * Generate a single-use, expiring invite link for a child's parent to create an
 * account (or sign in) and be auto-linked to that child + crèche. School-scoped;
 * only an admin of the child's crèche can mint one. Returns the shareable URL for
 * the crèche to email the parent.
 */
export async function createParentInviteAction(
  studentId: string,
  email?: string,
): Promise<InviteResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }

  const db = createSupabaseAdminClient()

  // The child must belong to this crèche.
  const { data: child } = await db
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }

  const token = randomBytes(32).toString('hex') // 64 hex chars
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()

  const { error } = await db.from('parent_invites').insert({
    school_id: schoolId,
    student_id: studentId,
    token,
    email: email?.trim() || null,
    expires_at: expiresAt,
    created_by: admin.id,
  })
  if (error) {
    logger.error('parent_invite_create_failed', { studentId, error: error.message })
    return { ok: false, error: 'Could not create the invite link. Please try again.' }
  }

  logger.info('parent_invite_created', { schoolId, studentId })
  return { ok: true, url: `${serverEnv.appUrl}/invite/${token}` }
}
