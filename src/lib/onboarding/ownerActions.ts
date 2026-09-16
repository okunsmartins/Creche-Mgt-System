'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { isPlatformOwner } from '@/lib/platform/owner'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'

export type SignupActionState = { error?: string; success?: boolean }

async function requireOwner(): Promise<SessionUser | null> {
  const user = await requireAuth()
  return isPlatformOwner(user) ? user : null
}

/** Owner marks a portal sign-up as confirmed without the email link. Idempotent. */
export async function confirmSignupAction(id: string): Promise<SignupActionState> {
  const owner = await requireOwner()
  if (!owner) return { error: 'Not authorized.' }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('portal_signups')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', id)
    .is('verified_at', null)
  if (error) {
    logger.error('portal_signup_confirm_failed', { id, error: error.message })
    return { error: 'Could not confirm the sign-up. Please try again.' }
  }

  logger.info('portal_signup_confirmed_manually', { id, by: owner.email })
  revalidatePath('/platform/signups')
  return { success: true }
}

/** Owner deletes a portal sign-up lead. */
export async function deleteSignupAction(id: string): Promise<SignupActionState> {
  const owner = await requireOwner()
  if (!owner) return { error: 'Not authorized.' }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('portal_signups').delete().eq('id', id)
  if (error) {
    logger.error('portal_signup_delete_failed', { id, error: error.message })
    return { error: 'Could not delete the sign-up. Please try again.' }
  }

  logger.info('portal_signup_deleted', { id, by: owner.email })
  revalidatePath('/platform/signups')
  return { success: true }
}
