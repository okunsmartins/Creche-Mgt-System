'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { encryptSecret, isEncryptionConfigured } from '@/lib/crypto/secrets'
import { logger } from '@/lib/logging'

export type RevolutSettingsState = { error?: string; success?: boolean } | null

/**
 * Save a school's own Revolut Merchant API key (+ optional webhook signing
 * secret), encrypted at rest. Admin-only. Once set, this school's Revolut parent
 * payments and refunds run on its own Revolut account.
 */
export async function saveRevolutCredentialsAction(
  _prev: RevolutSettingsState,
  formData: FormData,
): Promise<RevolutSettingsState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }
  if (!isEncryptionConfigured()) {
    return { error: 'Secure secret storage isn’t configured yet. Please contact support.' }
  }

  const apiKey = ((formData.get('apiKey') as string | null) ?? '').trim()
  const webhookSecret = ((formData.get('webhookSecret') as string | null) ?? '').trim()
  if (!apiKey) return { error: 'Enter your Revolut Merchant API key.' }

  const adminClient = createSupabaseAdminClient()
  const update: { revolut_api_key_enc: string; revolut_webhook_secret_enc?: string } = {
    revolut_api_key_enc: encryptSecret(apiKey),
  }
  if (webhookSecret) update.revolut_webhook_secret_enc = encryptSecret(webhookSecret)

  const { error } = await adminClient.from('schools').update(update).eq('id', admin.schoolId)
  if (error) {
    logger.error('revolut_creds_save_failed', { schoolId: admin.schoolId, error: error.message })
    return { error: 'Could not save your Revolut details. Please try again.' }
  }
  logger.info('revolut_creds_saved', { schoolId: admin.schoolId })
  revalidatePath('/admin/payments/connect')
  return { success: true }
}

/** Remove a school's Revolut credentials (revert to platform / disable). */
export async function disconnectRevolutAction(
  _prev: RevolutSettingsState,
  _formData: FormData,
): Promise<RevolutSettingsState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('schools')
    .update({ revolut_api_key_enc: null, revolut_webhook_secret_enc: null })
    .eq('id', admin.schoolId)
  if (error) {
    logger.error('revolut_creds_clear_failed', { schoolId: admin.schoolId, error: error.message })
    return { error: 'Could not remove your Revolut details. Please try again.' }
  }
  logger.info('revolut_creds_cleared', { schoolId: admin.schoolId })
  revalidatePath('/admin/payments/connect')
  return { success: true }
}
