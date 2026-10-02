import { describe, it, expect } from 'vitest'
import { hashCollectionPassword, verifyCollectionPassword } from '../password'

describe('collection password hashing', () => {
  it('round-trips: a correct word verifies', () => {
    const stored = hashCollectionPassword('Bluebell')
    expect(verifyCollectionPassword('Bluebell', stored)).toBe(true)
  })

  it('rejects the wrong word', () => {
    const stored = hashCollectionPassword('Bluebell')
    expect(verifyCollectionPassword('bluebell', stored)).toBe(false)
    expect(verifyCollectionPassword('Daisy', stored)).toBe(false)
  })

  it('never stores plaintext and uses a unique salt per call', () => {
    const a = hashCollectionPassword('Bluebell')
    const b = hashCollectionPassword('Bluebell')
    expect(a).not.toContain('Bluebell')
    expect(a).not.toBe(b) // different salts
    expect(a.startsWith('scrypt$')).toBe(true)
    // both still verify
    expect(verifyCollectionPassword('Bluebell', a)).toBe(true)
    expect(verifyCollectionPassword('Bluebell', b)).toBe(true)
  })

  it('handles null / malformed stored values without throwing', () => {
    expect(verifyCollectionPassword('x', null)).toBe(false)
    expect(verifyCollectionPassword('x', '')).toBe(false)
    expect(verifyCollectionPassword('x', 'garbage')).toBe(false)
    expect(verifyCollectionPassword('x', 'md5$aa$bb')).toBe(false)
  })

  it('normalises unicode so visually identical words match', () => {
    // é as single codepoint vs e + combining accent
    const stored = hashCollectionPassword('René')
    expect(verifyCollectionPassword('René', stored)).toBe(true)
  })
})
