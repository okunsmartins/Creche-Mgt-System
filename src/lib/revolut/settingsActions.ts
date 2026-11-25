'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { encryptSecret, isEncryptionConfigured } from '@/lib/crypto/secrets'
import { logger } from '@/lib/logging'
import { isRevolutSandbox } from './client'
import { resolveOwnRevolutApiKey } from './perSchool'
import { registerRevolutWebhook, removeRevolutWebhooks } from './webhooks'

export type RevolutSettingsState = { error?: string; success?: boolean } | null

/**
 * Audit trail for connecting / replacing / disconnecting Revolut. Payment-account
 * changes decide where parents' money goes, so the crèche can always see who changed
 * it and when. Never records the key or secret. Best-effort: a failed audit write is
 * logged, not shown to the admin (the change itself already succeeded).
 */
async function auditRevolutChange(
  admin: { id: string; email?: string | null; schoolId: string },
  change: 'connected' | 'key_replaced' | 'disconnected',
  extra: Record<string, string | boolean> = {},
): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email ?? '',
    action: 'settings.updated',
    resource_type: 'school',
    resource_id: admin.schoolId,
    metadata: { area: 'revolut', change, mode: isRevolutSandbox() ? 'sandbox' : 'live', ...extra },
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('revolut_settings_audit_failed', { error: error.message })
}

/**
 * Connect a crèche's own Revolut Business account. Admin-only.
 *
 * The admin pastes ONE thing: their Merchant API secret key. We then register
 * Creche Wise's webhook on their account automatically (which also proves the key
 * works) and store the key + the returned signing secret, encrypted at rest. An
 * optional manually-entered signing secret is still accepted as a fallback.
 */
export async function saveRevolutCredentialsAction(
  _prev: RevolutSettingsState,
  formData: FormData,
): Promise<RevolutSettingsState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }
  if (!isEncryptionConfigured()) {
    return { error: 'Secure secret storage isn’t configured yet. Please contact support.' }
  }

  const apiKey = ((formData.get('apiKey') as string | null) ?? '').trim()
  const manualSecret = ((formData.get('webhookSecret') as string | null) ?? '').trim()
  if (!apiKey) return { error: 'Paste your Revolut API key.' }
  if (/^pk_/i.test(apiKey)) {
    return {
      error: 'That’s your Public key. Paste the API key instead (Revolut API Console → API keys).',
    }
  }

  // Connecting for the first time, or swapping the key? (For the audit trail.)
  const wasConnected = Boolean(await resolveOwnRevolutApiKey(admin.schoolId))

  let signingSecret = manualSecret
  if (!signingSecret) {
    const reg = await registerRevolutWebhook(apiKey)
    if (!reg.ok) {
      const mode = isRevolutSandbox() ? 'Sandbox (test)' : 'live'
      const msg =
        reg.reason === 'bad_key'
          ? `Revolut didn’t accept that key. Check you copied the whole key, that it’s a ${mode} key, and that it has Merchant Orders and Webhooks set to Write.`
          : reg.reason === 'too_many'
            ? 'Your Revolut account already has the maximum of 10 webhooks. Delete an unused one in Revolut Business (APIs → Webhooks), then try again.'
            : 'We couldn’t finish connecting to Revolut. Please try again in a minute.'
      return { error: msg }
    }
    signingSecret = reg.signingSecret
  }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('schools')
    .update({
      revolut_api_key_enc: encryptSecret(apiKey),
      revolut_webhook_secret_enc: encryptSecret(signingSecret),
    })
    .eq('id', admin.schoolId)
  if (error) {
    logger.error('revolut_creds_save_failed', { schoolId: admin.schoolId, error: error.message })
    return { error: 'Could not save your Revolut details. Please try again.' }
  }
  logger.info('revolut_creds_saved', { schoolId: admin.schoolId, auto: !manualSecret })
  await auditRevolutChange(
    { id: admin.id, email: admin.email, schoolId: admin.schoolId },
    wasConnected ? 'key_replaced' : 'connected',
    { webhook: manualSecret ? 'manual_secret' : 'automatic' },
  )
  revalidatePath('/admin/payments/connect')
  return { success: true }
}

/** Disconnect the crèche's Revolut account: remove our webhook there, then clear the keys. */
export async function disconnectRevolutAction(
  _prev: RevolutSettingsState,
  _formData: FormData,
): Promise<RevolutSettingsState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }

  // Best-effort: stop Revolut sending us events for this account.
  const key = await resolveOwnRevolutApiKey(admin.schoolId)
  if (key) await removeRevolutWebhooks(key)

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
  await auditRevolutChange(
    { id: admin.id, email: admin.email, schoolId: admin.schoolId },
    'disconnected',
  )
  revalidatePath('/admin/payments/connect')
  return { success: true }
}
