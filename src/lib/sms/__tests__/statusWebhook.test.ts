import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  mapTwilioStatus,
  validateTwilioSignature,
  applyStatusUpdate,
  TERMINAL_SMS_STATUSES,
} from '../statusWebhook'

const TOKEN = 'test_auth_token'
const URL = 'https://skoolbido.com/api/webhooks/sms/status'

// Independent implementation of Twilio's documented signing algorithm.
function sign(url: string, params: Record<string, string>): string {
  let data = url
  for (const key of Object.keys(params).sort()) data += key + params[key]
  return createHmac('sha1', TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64')
}

describe('mapTwilioStatus', () => {
  it('maps final + interim statuses', () => {
    expect(mapTwilioStatus('delivered')).toBe('delivered')
    expect(mapTwilioStatus('undelivered')).toBe('undelivered')
    expect(mapTwilioStatus('failed')).toBe('failed')
    expect(mapTwilioStatus('sent')).toBe('sent')
    expect(mapTwilioStatus('queued')).toBe('queued')
    expect(mapTwilioStatus('sending')).toBe('queued')
  })

  it('ignores irrelevant statuses', () => {
    expect(mapTwilioStatus('received')).toBeNull()
    expect(mapTwilioStatus('read')).toBeNull()
    expect(mapTwilioStatus('')).toBeNull()
  })
})

describe('validateTwilioSignature', () => {
  const params = { MessageSid: 'SM123', MessageStatus: 'delivered', To: '+353871234567' }

  it('accepts a correctly-signed request', () => {
    expect(validateTwilioSignature(URL, params, sign(URL, params), TOKEN)).toBe(true)
  })

  it('rejects a tampered param (signature no longer matches)', () => {
    const good = sign(URL, params)
    const tampered = { ...params, MessageStatus: 'failed' }
    expect(validateTwilioSignature(URL, tampered, good, TOKEN)).toBe(false)
  })

  it('rejects a wrong auth token', () => {
    expect(validateTwilioSignature(URL, params, sign(URL, params), 'other_token')).toBe(false)
  })

  it('rejects a missing signature', () => {
    expect(validateTwilioSignature(URL, params, null, TOKEN)).toBe(false)
  })
})

describe('applyStatusUpdate', () => {
  interface Recorded {
    table?: string
    update?: Record<string, unknown>
    not?: [string, string, string]
    eq?: [string, string]
  }

  // Minimal chainable stand-in for the Supabase admin client query builder.
  function mockAdmin(rec: Recorded, error: { message: string } | null = null) {
    const chain = {
      from(table: string) {
        rec.table = table
        return chain
      },
      update(values: Record<string, unknown>) {
        rec.update = values
        return chain
      },
      not(column: string, op: string, value: string) {
        rec.not = [column, op, value]
        return chain
      },
      eq(column: string, value: string) {
        rec.eq = [column, value]
        return chain
      },
      then(resolve: (r: { error: { message: string } | null }) => void) {
        resolve({ error })
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return chain as any
  }

  it('updates sms_notifications by sid, guarding terminal states, with no error code', async () => {
    const rec: Recorded = {}
    await applyStatusUpdate(mockAdmin(rec), 'SM123', 'delivered', null)
    expect(rec.table).toBe('sms_notifications')
    expect(rec.update).toEqual({ status: 'delivered', failure_details: null })
    expect(rec.eq).toEqual(['provider_message_sid', 'SM123'])
    // Never overwrite a row already in a terminal state.
    expect(rec.not?.[0]).toBe('status')
    expect(rec.not?.[1]).toBe('in')
    for (const s of TERMINAL_SMS_STATUSES) expect(rec.not?.[2]).toContain(s)
  })

  it('records the Twilio error code on failure statuses', async () => {
    const rec: Recorded = {}
    await applyStatusUpdate(mockAdmin(rec), 'SM999', 'undelivered', '30006')
    expect(rec.update).toEqual({ status: 'undelivered', failure_details: 'Twilio error 30006' })
  })

  it('throws when the update returns a DB error', async () => {
    const rec: Recorded = {}
    await expect(
      applyStatusUpdate(mockAdmin(rec, { message: 'boom' }), 'SM1', 'sent', null),
    ).rejects.toThrow('boom')
  })
})
