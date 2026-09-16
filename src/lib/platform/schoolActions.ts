'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { schoolNameConfirmed } from '@/lib/platform/schoolGuards'
import type { SessionUser } from '@/types'

export type SchoolAdminState = { error?: string; success?: boolean }

/** Returns the owner user, or null when the caller is not the platform owner. */
async function requireOwner(): Promise<SessionUser | null> {
  const user = await requireAuth()
  return isPlatformOwner(user) ? user : null
}

/**
 * Deactivate (soft delete) or reactivate a school. Deactivating sets
 * `is_active = false`: the school drops out of the active lists and its portal
 * stops resolving, but every row it owns is preserved and the action is fully
 * reversible. Owner-only.
 */
export async function setSchoolActiveAction(
  schoolId: string,
  active: boolean,
): Promise<SchoolAdminState> {
  const owner = await requireOwner()
  if (!owner) return { error: 'Not authorized.' }

  const adminClient = createSupabaseAdminClient()
  // `.select()` lets us tell a real update from a 0-row no-op (bad id).
  const { data: updated, error } = await adminClient
    .from('schools')
    .update({ is_active: active })
    .eq('id', schoolId)
    .select('id')
  if (error) {
    logger.error('platform_school_set_active_failed', { schoolId, active, error: error.message })
    return { error: 'Could not update the school. Please try again.' }
  }
  if (!updated || updated.length === 0) return { error: 'School not found.' }

  logger.info('platform_school_set_active', { schoolId, active, by: owner.email })
  revalidatePath('/platform/schools')
  revalidatePath('/platform')
  return { success: true }
}

/**
 * Permanently delete a school and cascade-delete all of its tenant data
 * (students, classes, orders, payments, subscriptions, SMS, …). Parent/teacher
 * profiles and audit logs are detached (their `school_id` is nulled), not
 * destroyed. Irreversible.
 *
 * Two guards, both server-authoritative: the school must already be deactivated,
 * and the typed name must match exactly. Owner-only.
 */
export async function deleteSchoolAction(
  schoolId: string,
  typedName: string,
): Promise<SchoolAdminState> {
  const owner = await requireOwner()
  if (!owner) return { error: 'Not authorized.' }

  const adminClient = createSupabaseAdminClient()
  const { data: school } = await adminClient
    .from('schools')
    .select('name, is_active')
    .eq('id', schoolId)
    .maybeSingle()
  const row = school as { name: string; is_active: boolean } | null
  if (!row) return { error: 'School not found.' }

  if (row.is_active) {
    return { error: 'Deactivate the school first, then delete it permanently.' }
  }
  if (!schoolNameConfirmed(typedName, row.name)) {
    return { error: 'The name you typed does not match the school. Nothing was deleted.' }
  }

  const { error } = await adminClient.from('schools').delete().eq('id', schoolId)
  if (error) {
    logger.error('platform_school_delete_failed', { schoolId, error: error.message })
    return { error: 'Could not delete the school. Please try again.' }
  }

  logger.warn('platform_school_deleted', { schoolId, name: row.name, by: owner.email })
  revalidatePath('/platform/schools')
  revalidatePath('/platform')
  return { success: true }
}
