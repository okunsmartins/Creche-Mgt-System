import { describe, it, expect, beforeAll } from 'vitest'
import { encryptSecret, decryptSecret, isEncryptionConfigured } from '../secrets'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-only'
})

describe('secrets encryption', () => {
  it('reports configured when ENCRYPTION_KEY is set', () => {
    expect(isEncryptionConfigured()).toBe(true)
  })

  it('round-trips a secret', () => {
    const plain = 'sk_revolut_live_ABC123-secret'
    const enc = encryptSecret(plain)
    expect(enc).not.toContain(plain)
    expect(decryptSecret(enc)).toBe(plain)
  })

  it('produces a different ciphertext each time (random IV) but decrypts the same', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-value')
    expect(decryptSecret(b)).toBe('same-value')
  })

  it('throws on a tampered ciphertext (auth tag mismatch)', () => {
    const enc = encryptSecret('value')
    const [iv, tag, ct] = enc.split('.')
    // Flip a byte in the ciphertext portion.
    const tampered = `${iv}.${tag}.${Buffer.from((ct ?? '') + 'x').toString('base64')}`
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('throws on malformed input', () => {
    expect(() => decryptSecret('not-valid')).toThrow(/Malformed/)
  })
})
