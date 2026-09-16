import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyRevolutSignature } from '../signature'

const SECRET = 'wsk_test_secret_value'

function sign(rawBody: string, timestamp: string, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`v1.${timestamp}.${rawBody}`).digest('hex')
  return `v1=${mac}`
}

describe('verifyRevolutSignature', () => {
  const now = 1_700_000_000_000
  const ts = String(now)
  const body = '{"event":"ORDER_COMPLETED","order_id":"abc"}'

  it('accepts a correctly signed payload', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, ts),
        timestampHeader: ts,
        secret: SECRET,
        now,
      }),
    ).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body + ' ',
        signatureHeader: sign(body, ts),
        timestampHeader: ts,
        secret: SECRET,
        now,
      }),
    ).toBe(false)
  })

  it('rejects the wrong secret', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, ts, 'wsk_other'),
        timestampHeader: ts,
        secret: SECRET,
        now,
      }),
    ).toBe(false)
  })

  it('rejects a stale timestamp beyond tolerance', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, ts),
        timestampHeader: ts,
        secret: SECRET,
        now: now + 6 * 60 * 1000, // 6 min later, default tolerance 5 min
      }),
    ).toBe(false)
  })

  it('accepts a stale timestamp when tolerance is disabled', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, ts),
        timestampHeader: ts,
        secret: SECRET,
        now: now + 60 * 60 * 1000,
        toleranceMs: 0,
      }),
    ).toBe(true)
  })

  it('accepts when one of several rotated signatures matches', () => {
    const header = `${sign(body, ts, 'wsk_old')}, ${sign(body, ts)}`
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: header,
        timestampHeader: ts,
        secret: SECRET,
        now,
      }),
    ).toBe(true)
  })

  it('fails closed on missing header, timestamp, or secret', () => {
    const base = { rawBody: body, timestampHeader: ts, secret: SECRET, now }
    expect(verifyRevolutSignature({ ...base, signatureHeader: null })).toBe(false)
    expect(
      verifyRevolutSignature({ ...base, signatureHeader: sign(body, ts), timestampHeader: null }),
    ).toBe(false)
    expect(verifyRevolutSignature({ ...base, signatureHeader: sign(body, ts), secret: '' })).toBe(
      false,
    )
  })

  it('accepts a seconds-format timestamp (normalised for freshness only)', () => {
    // Revolut documents ms, but if a 10-digit seconds value arrives the freshness
    // window must still treat it as current. HMAC signs the raw string as-is.
    const tsSeconds = String(Math.floor(now / 1000))
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, tsSeconds),
        timestampHeader: tsSeconds,
        secret: SECRET,
        now,
      }),
    ).toBe(true)
  })

  it('rejects a non-numeric timestamp', () => {
    expect(
      verifyRevolutSignature({
        rawBody: body,
        signatureHeader: sign(body, 'not-a-number'),
        timestampHeader: 'not-a-number',
        secret: SECRET,
        now,
      }),
    ).toBe(false)
  })
})
