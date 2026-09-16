import { logger } from '@/lib/logging'

/**
 * Twilio SMS client (REST via fetch — no SDK dependency, mirrors the
 * Cloudflare/Vercel provisioning approach). Reads config lazily from
 * `process.env` so importing this module never triggers env validation, and the
 * whole feature is INERT until Twilio is configured.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID.
 * Optional: TWILIO_STATUS_CALLBACK_URL (delivery-status webhook, Phase 4).
 */

export interface SmsConfig {
  accountSid: string
  authToken: string
  messagingServiceSid: string
  statusCallbackUrl: string | null
}

export function getSmsConfig(): SmsConfig | null {
  const accountSid = process.env['TWILIO_ACCOUNT_SID']
  const authToken = process.env['TWILIO_AUTH_TOKEN']
  const messagingServiceSid = process.env['TWILIO_MESSAGING_SERVICE_SID']
  if (!accountSid || !authToken || !messagingServiceSid) return null
  return {
    accountSid,
    authToken,
    messagingServiceSid,
    statusCallbackUrl: process.env['TWILIO_STATUS_CALLBACK_URL'] || null,
  }
}

export type SendSmsResult = { ok: true; sid: string } | { ok: false; error: string }

const REQUEST_TIMEOUT_MS = 15_000

/** Send one SMS via Twilio. `to` must be E.164. Never throws — returns a result. */
export async function sendSms(
  to: string,
  body: string,
  config: SmsConfig | null = getSmsConfig(),
): Promise<SendSmsResult> {
  if (!config) return { ok: false, error: 'SMS is not configured' }

  const form = new URLSearchParams({
    To: to,
    MessagingServiceSid: config.messagingServiceSid,
    Body: body,
  })
  if (config.statusCallbackUrl) form.set('StatusCallback', config.statusCallbackUrl)

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

  let res: Response
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Twilio request failed' }
  }

  const json = (await res.json().catch(() => null)) as {
    sid?: string
    message?: string
    code?: number
  } | null

  if (res.ok && json?.sid) return { ok: true, sid: json.sid }

  const error = json?.message || `HTTP ${res.status}`
  logger.error('sms_send_failed', { to, status: res.status, code: json?.code, error })
  return { ok: false, error }
}
