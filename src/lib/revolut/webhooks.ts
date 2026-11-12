import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { revolutRequest, RevolutApiError } from './client'

/**
 * Automatic webhook setup for a crèche's own Revolut account. When an admin saves
 * their Merchant API key we register Creche Wise's webhook on THEIR account and
 * keep the signing secret Revolut returns, so they never have to create a webhook
 * or copy a secret by hand. This also proves the key works.
 */

/** Events the webhook route acts on (payment success + failure paths). */
export const REVOLUT_WEBHOOK_EVENTS = [
  'ORDER_COMPLETED',
  'ORDER_AUTHORISED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_PAYMENT_DECLINED',
  'ORDER_PAYMENT_FAILED',
] as const

/** Where Revolut should send events for this deployment. */
export function revolutWebhookUrl(): string {
  return `${serverEnv.appUrl.replace(/\/+$/, '')}/api/webhooks/revolut`
}

interface RevolutWebhook {
  id: string
  url: string
  events?: string[]
  signing_secret?: string
}

export type RegisterResult =
  | { ok: true; signingSecret: string }
  | { ok: false; reason: 'bad_key' | 'too_many' | 'failed' }

/**
 * Register (or re-register) our webhook on the crèche's Revolut account and return
 * its signing secret. Any existing webhook pointing at our URL is removed first, so
 * re-saving a key never piles up duplicates (Revolut allows at most 10).
 */
export async function registerRevolutWebhook(apiKey: string): Promise<RegisterResult> {
  const url = revolutWebhookUrl()
  try {
    await removeRevolutWebhooks(apiKey, { throwOnAuth: true })
    const created = await revolutRequest<RevolutWebhook>('POST', '/api/webhooks', apiKey, {
      url,
      events: REVOLUT_WEBHOOK_EVENTS,
    })
    if (!created.signing_secret) {
      logger.error('revolut_webhook_no_secret_returned', {})
      return { ok: false, reason: 'failed' }
    }
    return { ok: true, signingSecret: created.signing_secret }
  } catch (err) {
    if (err instanceof RevolutApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, reason: 'bad_key' }
    }
    if (err instanceof RevolutApiError && err.status === 422) {
      return { ok: false, reason: 'too_many' }
    }
    logger.error('revolut_webhook_register_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    return { ok: false, reason: 'failed' }
  }
}

/** Remove every webhook on the crèche's account that points at our URL. Best-effort. */
export async function removeRevolutWebhooks(
  apiKey: string,
  opts: { throwOnAuth?: boolean } = {},
): Promise<number> {
  const url = revolutWebhookUrl()
  let removed = 0
  try {
    const list = await revolutRequest<RevolutWebhook[]>('GET', '/api/webhooks', apiKey)
    for (const w of Array.isArray(list) ? list : []) {
      if (w.url === url) {
        await revolutRequest('DELETE', `/api/webhooks/${encodeURIComponent(w.id)}`, apiKey)
        removed++
      }
    }
  } catch (err) {
    if (
      opts.throwOnAuth &&
      err instanceof RevolutApiError &&
      (err.status === 401 || err.status === 403)
    ) {
      throw err
    }
    logger.warn('revolut_webhook_cleanup_failed', {
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
  return removed
}
