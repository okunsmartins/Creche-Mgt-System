import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  eurosToCents,
  centsToEuros,
  maskEmail,
  createCorrelationId,
  randomHex,
  cn,
  schoolCodePrefix,
} from '../utils'

// ─── Currency calculations ────────────────────────────────────────────────────

describe('eurosToCents', () => {
  it('converts whole euros to cents', () => {
    expect(eurosToCents(25)).toBe(2500)
    expect(eurosToCents(1)).toBe(100)
    expect(eurosToCents(0)).toBe(0)
  })

  it('converts fractional euros, rounding correctly', () => {
    expect(eurosToCents(12.5)).toBe(1250)
    expect(eurosToCents(0.01)).toBe(1)
    expect(eurosToCents(0.99)).toBe(99)
  })

  it('avoids floating-point drift (the classic 0.1 + 0.2 problem)', () => {
    // Without Math.round, 0.1 + 0.2 = 0.30000000000000004
    expect(eurosToCents(0.1 + 0.2)).toBe(30)
  })

  it('rounds half-up on the third decimal place', () => {
    // €75.005 → 7500.5 cents → rounds to 7501
    expect(eurosToCents(75.005)).toBe(7501)
    // €75.004 → 7500.4 cents → rounds to 7500
    expect(eurosToCents(75.004)).toBe(7500)
  })
})

describe('centsToEuros', () => {
  it('converts cents to euros', () => {
    expect(centsToEuros(2500)).toBe(25)
    expect(centsToEuros(100)).toBe(1)
    expect(centsToEuros(0)).toBe(0)
    expect(centsToEuros(1250)).toBe(12.5)
  })

  it('is the inverse of eurosToCents for whole-cent amounts', () => {
    const cases = [0, 1, 99, 100, 1250, 7500, 100000]
    cases.forEach((cents) => {
      expect(eurosToCents(centsToEuros(cents))).toBe(cents)
    })
  })
})

describe('formatCurrency', () => {
  it('formats cents as a localised EUR string', () => {
    // en-IE locale formats as €25.00
    expect(formatCurrency(2500)).toBe('€25.00')
    expect(formatCurrency(100)).toBe('€1.00')
    expect(formatCurrency(0)).toBe('€0.00')
  })

  it('always shows two decimal places', () => {
    expect(formatCurrency(2550)).toBe('€25.50')
    expect(formatCurrency(2501)).toBe('€25.01')
  })

  it('formats large amounts correctly', () => {
    expect(formatCurrency(1000000)).toBe('€10,000.00')
  })

  it('accepts an explicit currency code', () => {
    // Should not throw; other currency codes are passed through
    expect(() => formatCurrency(1000, 'EUR')).not.toThrow()
  })
})

// ─── Email masking ────────────────────────────────────────────────────────────

describe('maskEmail', () => {
  it('masks a typical email address', () => {
    expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com')
  })

  it('handles short local parts (≤2 chars)', () => {
    expect(maskEmail('jo@example.com')).toBe('j***@example.com')
    expect(maskEmail('j@example.com')).toBe('j***@example.com')
  })

  it('returns the original string if no @ is present', () => {
    expect(maskEmail('notanemail')).toBe('notanemail')
  })

  it('does not expose the full local part', () => {
    const masked = maskEmail('admin@scoilbhride.ie')
    expect(masked).not.toContain('admin')
    expect(masked).toContain('@scoilbhride.ie')
  })
})

// ─── Reference format helpers ─────────────────────────────────────────────────

describe('createCorrelationId', () => {
  it('creates a non-empty string with the expected prefix', () => {
    const id = createCorrelationId()
    expect(id).toMatch(/^cid_\d+_[0-9a-f]{16}$/)
  })

  it('generates unique IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createCorrelationId()))
    expect(ids.size).toBe(100)
  })
})

describe('randomHex', () => {
  it('returns a hex string of the correct length', () => {
    // 16 bytes → 32 hex chars
    expect(randomHex(16)).toHaveLength(32)
    expect(randomHex(8)).toHaveLength(16)
    expect(randomHex(1)).toHaveLength(2)
  })

  it('only contains valid hex characters', () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]+$/)
  })

  it('generates unique outputs (collision check)', () => {
    const outputs = new Set(Array.from({ length: 50 }, () => randomHex(16)))
    expect(outputs.size).toBe(50)
  })
})

// ─── Tailwind class merging ───────────────────────────────────────────────────

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge picks the last padding class
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'not-included', 'included')).toBe('base included')
  })

  it('handles undefined and null without throwing', () => {
    expect(() => cn('foo', undefined, null, 'bar')).not.toThrow()
  })
})

// ─── School code prefix ─────────────────────────────────────────────────────────

describe('schoolCodePrefix', () => {
  it('uses up to three word initials', () => {
    expect(schoolCodePrefix('St Peters Primary School')).toBe('SPP')
  })

  it('handles two-word names', () => {
    expect(schoolCodePrefix('Scoil Demo')).toBe('SD')
  })

  it('falls back to leading characters for single-word names', () => {
    expect(schoolCodePrefix('Riverside')).toBe('RIV')
  })

  it('strips punctuation from initials', () => {
    expect(schoolCodePrefix("St. Brigid's N.S.")).toBe('SBN')
  })

  it('falls back to SCH for empty or unusable names', () => {
    expect(schoolCodePrefix('')).toBe('SCH')
    expect(schoolCodePrefix('   ')).toBe('SCH')
    expect(schoolCodePrefix('!')).toBe('SCH')
  })
})
