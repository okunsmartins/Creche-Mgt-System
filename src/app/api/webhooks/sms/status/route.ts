import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { getSmsConfig } from '@/lib/sms/client'
import {
  mapTwilioStatus,
  validateTwilioSignature,
  applyStatusUpdate,
} from '@/lib/sms/statusWebhook'

// Twilio delivery-status callback (configured as TWILIO_STATUS_CALLBACK_URL and
// sent per message). Under /api/webhooks/ so it bypasses the auth middleware.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const config = getSmsConfig()
  if (!config || !config.statusCallbackUrl) {
    // SMS not configured — nothing to update; ack so Twilio doesn't retry.
    return NextResponse.json({ received: true })
  }

  const raw = await request.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v

  const signature = request.headers.get('x-twilio-signature')
  if (!validateTwilioSignature(config.statusCallbackUrl, params, signature, config.authToken)) {
    logger.warn('sms_status_signature_invalid')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const sid = params['MessageSid'] ?? params['SmsSid'] ?? ''
  const twilioStatus = params['MessageStatus'] ?? params['SmsStatus'] ?? ''
  const errorCode = params['ErrorCode'] || null
  if (!sid || !twilioStatus) return NextResponse.json({ received: true })

  const status = mapTwilioStatus(twilioStatus)
  if (!status) return NextResponse.json({ received: true })

  try {
    await applyStatusUpdate(createSupabaseAdminClient(), sid, status, errorCode)
  } catch (err) {
    logger.error('sms_status_webhook_failed', {
      sid,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
