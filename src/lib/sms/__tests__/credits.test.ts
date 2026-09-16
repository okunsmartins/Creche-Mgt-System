import { describe, it, expect } from 'vitest'
import { quoteCharge, applyCharge, periodStartOf, periodReset } from '../credits'

describe('quoteCharge', () => {
  it('takes the whole cost from the allowance when it fits', () => {
    const q = quoteCharge({ includedLimit: 100, includedUsed: 0, credits: 0 }, 30, 1)
    expect(q).toEqual({
      needed: 30,
      fromAllowance: 30,
      fromCredits: 0,
      affordable: true,
      shortfall: 0,
    })
  })

  it('spills over into credits once the allowance is exhausted', () => {
    const q = quoteCharge({ includedLimit: 100, includedUsed: 90, credits: 50 }, 30, 1)
    expect(q).toEqual({
      needed: 30,
      fromAllowance: 10,
      fromCredits: 20,
      affordable: true,
      shortfall: 0,
    })
  })

  it('reports a shortfall when neither allowance nor credits cover it', () => {
    const q = quoteCharge({ includedLimit: 100, includedUsed: 90, credits: 0 }, 30, 1)
    expect(q).toMatchObject({
      needed: 30,
      fromAllowance: 10,
      fromCredits: 0,
      affordable: false,
      shortfall: 20,
    })
  })

  it('multiplies by segments per message', () => {
    const q = quoteCharge({ includedLimit: 100, includedUsed: 0, credits: 0 }, 60, 2)
    expect(q).toMatchObject({ needed: 120, fromAllowance: 100, affordable: false, shortfall: 20 })
  })
})

describe('applyCharge', () => {
  it('debits allowance then credits', () => {
    const balance = { includedLimit: 100, includedUsed: 90, credits: 50 }
    const q = quoteCharge(balance, 30, 1)
    expect(applyCharge(balance, q)).toEqual({ includedLimit: 100, includedUsed: 100, credits: 30 })
  })
})

describe('period reset', () => {
  it('computes the first of the month', () => {
    expect(periodStartOf(new Date('2026-07-29T12:00:00Z'))).toBe('2026-07-01')
  })

  it('resets when the stored period is an earlier month', () => {
    expect(periodReset('2026-06-01', new Date('2026-07-15T00:00:00Z'))).toEqual({
      includedUsed: 0,
      periodStart: '2026-07-01',
    })
  })

  it('does not reset within the same month', () => {
    expect(periodReset('2026-07-01', new Date('2026-07-29T00:00:00Z'))).toBeNull()
  })
})
