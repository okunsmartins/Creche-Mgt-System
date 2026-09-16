import { describe, it, expect } from 'vitest'
import {
  INSTALMENT_MIN_CENTS,
  INSTALMENT_COUNT,
  isInstalmentEligible,
  instalmentAmountsCents,
  nextInstalmentCents,
  instalmentsRemaining,
} from '../instalments'

describe('isInstalmentEligible', () => {
  it('requires a minimum of €20', () => {
    expect(isInstalmentEligible(INSTALMENT_MIN_CENTS - 1)).toBe(false)
    expect(isInstalmentEligible(INSTALMENT_MIN_CENTS)).toBe(true)
    expect(isInstalmentEligible(5000)).toBe(true)
  })
})

describe('instalmentAmountsCents', () => {
  it('splits an evenly-divisible total into 4 equal parts', () => {
    expect(instalmentAmountsCents(2000)).toEqual([500, 500, 500, 500])
  })

  it('spreads the remainder across the first instalments and sums to the total', () => {
    const amounts = instalmentAmountsCents(2001)
    expect(amounts).toEqual([501, 500, 500, 500])
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(2001)
  })

  it('always returns INSTALMENT_COUNT parts that sum exactly to the total', () => {
    for (const total of [2000, 2001, 2002, 2003, 4567, 9999]) {
      const amounts = instalmentAmountsCents(total)
      expect(amounts).toHaveLength(INSTALMENT_COUNT)
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})

describe('nextInstalmentCents', () => {
  it('charges the first instalment when nothing is paid', () => {
    expect(nextInstalmentCents(2001, 0)).toBe(501)
    expect(nextInstalmentCents(2000, 0)).toBe(500)
  })

  it('walks through the schedule as instalments are paid', () => {
    // 2001 → [501, 500, 500, 500]
    expect(nextInstalmentCents(2001, 501)).toBe(500)
    expect(nextInstalmentCents(2001, 1001)).toBe(500)
    expect(nextInstalmentCents(2001, 1501)).toBe(500)
  })

  it('returns 0 once fully paid', () => {
    expect(nextInstalmentCents(2000, 2000)).toBe(0)
    expect(nextInstalmentCents(2000, 2500)).toBe(0)
  })

  it('a sequence of next-instalment payments sums exactly to the total', () => {
    const total = 4567
    let paid = 0
    let payments = 0
    while (paid < total && payments < 10) {
      const next = nextInstalmentCents(total, paid)
      expect(next).toBeGreaterThan(0)
      paid += next
      payments += 1
    }
    expect(paid).toBe(total)
    expect(payments).toBe(INSTALMENT_COUNT)
  })
})

describe('instalmentsRemaining', () => {
  it('counts unpaid instalments', () => {
    expect(instalmentsRemaining(2000, 0)).toBe(4)
    expect(instalmentsRemaining(2000, 500)).toBe(3)
    expect(instalmentsRemaining(2000, 1500)).toBe(1)
    expect(instalmentsRemaining(2000, 2000)).toBe(0)
  })
})
