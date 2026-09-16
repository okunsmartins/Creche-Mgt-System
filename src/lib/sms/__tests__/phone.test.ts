import { describe, it, expect } from 'vitest'
import { normalizeIrishMobile } from '../phone'

describe('normalizeIrishMobile', () => {
  it('normalises common Irish mobile formats to E.164', () => {
    const expected = '+353871234567'
    expect(normalizeIrishMobile('087 123 4567')).toBe(expected)
    expect(normalizeIrishMobile('0871234567')).toBe(expected)
    expect(normalizeIrishMobile('+353 87 123 4567')).toBe(expected)
    expect(normalizeIrishMobile('00353871234567')).toBe(expected)
    expect(normalizeIrishMobile('353871234567')).toBe(expected)
    expect(normalizeIrishMobile('871234567')).toBe(expected)
  })

  it('handles the "+353 (0)87" trunk-zero data-entry format', () => {
    const expected = '+353871234567'
    expect(normalizeIrishMobile('+353 (0)87 123 4567')).toBe(expected)
    expect(normalizeIrishMobile('+3530871234567')).toBe(expected)
    expect(normalizeIrishMobile('003530871234567')).toBe(expected)
  })

  it('accepts other Irish mobile prefixes (083/085/086/089)', () => {
    expect(normalizeIrishMobile('085 555 1234')).toBe('+353855551234')
    expect(normalizeIrishMobile('089 999 8888')).toBe('+353899998888')
  })

  it('rejects landlines, non-Irish, and junk', () => {
    expect(normalizeIrishMobile('01 234 5678')).toBeNull() // Dublin landline
    expect(normalizeIrishMobile('+44 7911 123456')).toBeNull() // UK
    expect(normalizeIrishMobile('12345')).toBeNull()
    expect(normalizeIrishMobile('not a number')).toBeNull()
    expect(normalizeIrishMobile('')).toBeNull()
    expect(normalizeIrishMobile(null)).toBeNull()
  })
})
