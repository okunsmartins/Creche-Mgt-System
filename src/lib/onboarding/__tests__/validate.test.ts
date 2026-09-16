import { describe, it, expect } from 'vitest'
import { normalizeEmail, isValidEmail } from '../validate'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Head@School.IE ')).toBe('head@school.ie')
  })
})

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('principal@stmarys.ie')).toBe(true)
    expect(isValidEmail('  Principal@StMarys.ie ')).toBe(true)
  })

  it('rejects malformed or empty values', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.ie')).toBe(false)
    expect(isValidEmail('@x.ie')).toBe(false)
  })

  it('rejects an over-long address', () => {
    expect(isValidEmail('a'.repeat(250) + '@x.ie')).toBe(false)
  })
})
