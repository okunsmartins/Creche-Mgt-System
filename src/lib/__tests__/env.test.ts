import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * Env access is lazy: importing the module must NOT read process.env (so
 * `next build` / page-data collection never fails on a missing var), and a
 * missing REQUIRED var only throws when it is actually accessed.
 */
describe('env (lazy access)', () => {
  const KEY = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  const original = process.env[KEY]

  beforeEach(() => {
    delete process.env[KEY]
  })
  afterEach(() => {
    if (original === undefined) delete process.env[KEY]
    else process.env[KEY] = original
  })

  it('importing the module does not throw even when a required var is absent', async () => {
    await expect(import('../env')).resolves.toBeDefined()
  })

  it('accessing a missing required var throws a clear error', async () => {
    const { clientEnv } = await import('../env')
    expect(() => clientEnv.stripePublishableKey).toThrow(new RegExp(KEY))
  })

  it('accessing a present var returns its value (read at access time)', async () => {
    process.env[KEY] = 'pk_test_example'
    const { clientEnv } = await import('../env')
    expect(clientEnv.stripePublishableKey).toBe('pk_test_example')
  })

  it('optional vars fall back without throwing', async () => {
    const { serverEnv } = await import('../env')
    expect(() => serverEnv.stripeProSmsMonthlyPriceId).not.toThrow()
    expect(serverEnv.emailFromName).toBeTruthy() // has a default fallback
  })
})
