import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import the private sanitise logic by testing logger output
// We test via the exported logger rather than the private function directly

describe('logger sanitisation', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts the "password" key', async () => {
    const { logger } = await import('../logging')
    logger.warn('test', { password: 'supersecret123' })
    const [output] = warnSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed['password']).toBe('[REDACTED]')
  })

  it('redacts the "secret" key', async () => {
    const { logger } = await import('../logging')
    logger.warn('test', { secret: 'sk_test_abc123' })
    const [output] = warnSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed['secret']).toBe('[REDACTED]')
  })

  it('redacts "token", "key", "card", "cvv", "cvc", "pan"', async () => {
    const { logger } = await import('../logging')
    const sensitiveFields = {
      token: 'tok_abc',
      key: 'pk_test_abc',
      card: '4242424242424242',
      cvv: '123',
      cvc: '456',
      pan: '4111111111111111',
    }
    logger.warn('test', sensitiveFields)
    const [output] = warnSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    Object.keys(sensitiveFields).forEach((k) => {
      expect(parsed[k]).toBe('[REDACTED]')
    })
  })

  it('does not redact safe metadata fields', async () => {
    const { logger } = await import('../logging')
    logger.info('order created', { orderId: 'ORD-2026-000001', amount: 2500 })
    const [output] = logSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed['orderId']).toBe('ORD-2026-000001')
    expect(parsed['amount']).toBe(2500)
  })

  it('includes level and message in the output', async () => {
    const { logger } = await import('../logging')
    logger.error('something went wrong', { code: 'ERR_001' })
    const [output] = errorSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed['level']).toBe('error')
    expect(parsed['message']).toBe('something went wrong')
    expect(parsed['code']).toBe('ERR_001')
  })

  it('includes a timestamp in ISO 8601 format', async () => {
    const { logger } = await import('../logging')
    logger.info('test')
    const [output] = logSpy.mock.calls[0] as [string]
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(typeof parsed['timestamp']).toBe('string')
    expect(() => new Date(parsed['timestamp'] as string)).not.toThrow()
    expect(new Date(parsed['timestamp'] as string).toISOString()).toBe(parsed['timestamp'])
  })
})

// ─── Reference format validation ─────────────────────────────────────────────
// These regexes match what the SQL reference functions produce.
// Validated here as the TypeScript layer that will format/display them.

describe('payment reference format', () => {
  const ORDER_REF = /^ORD-\d{4}-\d{6}$/
  const PAYMENT_REF = /^PAY-\d{4}-\d{6}$/
  const ITEM_REF = /^ITEM-\d{4}-\d{6}$/
  const REFUND_REF = /^REF-\d{4}-\d{6}$/
  // Charset: A-H J-N P-Z 2-9 — excludes ambiguous I O 0 1 (matches generate_pupil_code() SQL)
  const PUPIL_CODE = /^SB-[A-HJ-NP-Z2-9]{8}$/

  it('validates order reference format', () => {
    expect('ORD-2026-000001').toMatch(ORDER_REF)
    expect('ORD-2026-999999').toMatch(ORDER_REF)
    expect('ORD-2026-1').not.toMatch(ORDER_REF) // too short
    expect('ord-2026-000001').not.toMatch(ORDER_REF) // lowercase
  })

  it('validates payment reference format', () => {
    expect('PAY-2026-000001').toMatch(PAYMENT_REF)
    expect('PAY-2025-123456').toMatch(PAYMENT_REF)
    expect('PAY-26-000001').not.toMatch(PAYMENT_REF) // 2-digit year
  })

  it('validates order item reference format', () => {
    expect('ITEM-2026-000001').toMatch(ITEM_REF)
    expect('ITEM-2026-999999').toMatch(ITEM_REF)
    expect('ITM-2026-000001').not.toMatch(ITEM_REF)
  })

  it('validates refund reference format', () => {
    expect('REF-2026-000001').toMatch(REFUND_REF)
    expect('REF-2026-999999').toMatch(REFUND_REF)
    expect('REF-26-000001').not.toMatch(REFUND_REF)
  })

  it('validates pupil payment code format', () => {
    expect('SB-ABCDEF23').toMatch(PUPIL_CODE)
    expect('SB-GHHJKNP2').toMatch(PUPIL_CODE)
    // Seed data examples (valid codes from supabase/seed.sql)
    expect('SB-AM224567').toMatch(PUPIL_CODE) // Aoife Murphy
    expect('SB-CS556782').toMatch(PUPIL_CODE) // Cormac Sheridan
    // Must not contain I, O, 0, 1 (ambiguous chars excluded by generate_pupil_code())
    expect('SB-OO000000').not.toMatch(PUPIL_CODE) // O and 0 excluded
    expect('SB-II111111').not.toMatch(PUPIL_CODE) // I and 1 excluded
    expect('SB-ABCDEF23'.toLowerCase()).not.toMatch(PUPIL_CODE) // lowercase rejected
    expect('SB-ABCDEF2').not.toMatch(PUPIL_CODE) // too short (7 chars)
    expect('SB-ABCDEF234').not.toMatch(PUPIL_CODE) // too long (9 chars)
  })
})
