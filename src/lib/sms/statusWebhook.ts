import { createHmac, timingSafeEqual } from 'crypto'
import type { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered'

/** Map a Twilio `MessageStatus` to our stored status, or null to ignore it. */
export function mapTwilioStatus(status: string): SmsDeliveryStatus | null {
  switch (status) {
    case 'delivered':
      return 'delivered'
    case 'undelivered':
      return 'undelivered'
    case 'failed':
      return 'failed'
    case 'sent':
      return 'sent'
    case 'queued':
    case 'accepted':
    case 'scheduled':
    case 'sending':
      return 'queued'
    default:
      return null // inbound / read / etc. — not applicable
  }
}

/**
 * Verify a Twilio request signature (X-Twilio-Signature). Twilio signs the exact
 * callback URL plus the POST params (sorted by key, concatenated), HMAC-SHA1 with
 * the account auth token, base64. Without this, anyone could POST forged delivery
 * statuses. Constant-time compare.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string,
): boolean {
  if (!signature) return false
  let data = url
  for (const key of Object.keys(params).sort()) data += key + params[key]
  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Terminal delivery states. Once a row reaches one of these, a later callback
 * must never overwrite it — Twilio status callbacks are at-least-once and not
 * strictly ordered, so a stale `queued`/`sent` arriving after `delivered` would
 * otherwise wrongly downgrade the recorded outcome.
 */
export const TERMINAL_SMS_STATUSES: readonly SmsDeliveryStatus[] = [
  'delivered',
  'failed',
  'undelivered',
]

/** Update the delivery status of the sms_notifications row for a message sid. */
export async function applyStatusUpdate(
  adminClient: AdminClient,
  sid: string,
  status: SmsDeliveryStatus,
  errorCode: string | null,
): Promise<void> {
  const { error } = await adminClient
    .from('sms_notifications')
    .update({
      status,
      failure_details: errorCode ? `Twilio error ${errorCode}` : null,
    })
    // Don't downgrade a row that's already in a terminal state (out-of-order/duplicate callbacks).
    .not('status', 'in', `(${TERMINAL_SMS_STATUSES.join(',')})`)
    .eq('provider_message_sid', sid)
  if (error) {
    logger.error('sms_status_update_failed', { sid, status, error: error.message })
    throw new Error(error.message)
  }
}
