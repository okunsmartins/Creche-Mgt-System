import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { decryptSecret, isEncryptionConfigured } from '@/lib/crypto/secrets'
import { logger } from '@/lib/logging'
import type { SchoolRow } from '@/types/database'

/**
 * Per-school Revolut credentials (Connect-style): each school may store its OWN
 * Revolut Merchant API key + webhook secret (encrypted at rest) so parent
 * payments go straight to the school. When a school hasn't configured Revolut,
 * these resolvers fall back to the PLATFORM key/secret — so nothing breaks for
 * schools that haven't opted in (additive).
 */

type Enc = Pick<SchoolRow, 'revolut_api_key_enc' | 'revolut_webhook_secret_enc'>

async function loadEnc(schoolId: string): Promise<Enc | null> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('schools')
    .select('revolut_api_key_enc, revolut_webhook_secret_enc')
    .eq('id', schoolId)
    .maybeSingle()
  return (data as Enc | null) ?? null
}

function safeDecrypt(enc: string | null | undefined): string | null {
  if (!enc || !isEncryptionConfigured()) return null
  try {
    return decryptSecret(enc)
  } catch {
    logger.error('revolut_secret_decrypt_failed', {})
    return null
  }
}

/** The school's own Revolut API key if configured, else the platform key. */
export async function resolveRevolutApiKey(schoolId: string | null | undefined): Promise<string> {
  if (!schoolId) return serverEnv.revolutApiKey
  const enc = await loadEnc(schoolId)
  return safeDecrypt(enc?.revolut_api_key_enc) || serverEnv.revolutApiKey
}

/** The school's own Revolut webhook secret if configured, else the platform secret. */
export async function resolveRevolutWebhookSecret(
  schoolId: string | null | undefined,
): Promise<string> {
  if (!schoolId) return serverEnv.revolutWebhookSecret
  const enc = await loadEnc(schoolId)
  return safeDecrypt(enc?.revolut_webhook_secret_enc) || serverEnv.revolutWebhookSecret
}

/** Whether the school has configured its OWN Revolut key (vs relying on platform). */
export async function schoolHasOwnRevolut(schoolId: string): Promise<boolean> {
  const enc = await loadEnc(schoolId)
  return Boolean(safeDecrypt(enc?.revolut_api_key_enc))
}

/**
 * Resolve the school that owns a Revolut order from the webhook's
 * `merchant_order_ext_ref` (we set it to `<order_reference>-<amount_paid>` at
 * checkout creation). Returns the school id, or null if it can't be resolved
 * (caller falls back to platform credentials).
 */
export async function schoolIdFromExtRef(
  extRef: string | null | undefined,
): Promise<string | null> {
  if (!extRef) return null
  // Strip the trailing `-<amount_paid_cents>` suffix to recover the order_reference.
  const orderReference = extRef.replace(/-\d+$/, '')
  if (!orderReference) return null
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('orders')
    .select('school_id')
    .eq('order_reference', orderReference)
    .maybeSingle()
  return (data as { school_id: string | null } | null)?.school_id ?? null
}
