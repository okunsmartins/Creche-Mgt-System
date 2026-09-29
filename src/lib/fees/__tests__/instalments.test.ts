import { describe, it, expect } from 'vitest'
import {
  isInvoiceInstalmentEligible,
  normaliseInstalmentCount,
  instalmentAmountsCents,
  buildInstalmentPlan,
} from '../instalments'

describe('isInvoiceInstalmentEligible — strictly > €20', () => {
  it('excludes exactly €20.00, includes €20.01', () => {
    expect(isInvoiceInstalmentEligible(2000)).toBe(false)
    expect(isInvoiceInstalmentEligible(2001)).toBe(true)
    expect(isInvoiceInstalmentEligible(1999)).toBe(false)
  })
})

describe('normaliseInstalmentCount', () => {
  it('accepts 2/3/4, defaults others to 4', () => {
    expect(normaliseInstalmentCount(2)).toBe(2)
    expect(normaliseInstalmentCount(3)).toBe(3)
    expect(normaliseInstalmentCount(4)).toBe(4)
    expect(normaliseInstalmentCount(1)).toBe(4)
    expect(normaliseInstalmentCount(7)).toBe(4)
  })
})

describe('instalmentAmountsCents — exact sum, spread remainder', () => {
  it('splits into N parts summing exactly to total', () => {
    for (const [total, count] of [
      [10000, 4],
      [1000, 3],
      [2501, 2],
      [9999, 4],
    ] as const) {
      const parts = instalmentAmountsCents(total, count)
      expect(parts).toHaveLength(count)
      expect(parts.reduce((s, p) => s + p, 0)).toBe(total)
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
    }
  })
  it('1000 into 3 → [334,333,333]', () => {
    expect(instalmentAmountsCents(1000, 3)).toEqual([334, 333, 333])
  })
})

describe('buildInstalmentPlan', () => {
  it('below threshold → single pay-in-full instalment', () => {
    const p = buildInstalmentPlan({
      totalCents: 2000,
      count: 4,
      frequency: 'monthly',
      firstDueISO: '2026-09-01',
    })
    expect(p.eligible).toBe(false)
    expect(p.instalments).toEqual([{ dueDate: '2026-09-01', amountCents: 2000 }])
  })

  it('monthly plan of 4 steps by calendar month and sums exactly', () => {
    const p = buildInstalmentPlan({
      totalCents: 24001,
      count: 4,
      frequency: 'monthly',
      firstDueISO: '2026-01-15',
    })
    expect(p.eligible).toBe(true)
    expect(p.instalments.map((i) => i.dueDate)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ])
    expect(p.instalments.reduce((s, i) => s + i.amountCents, 0)).toBe(24001)
    expect(p.instalments[0]!.amountCents).toBe(6001) // remainder cent on the first
  })

  it('weekly and fortnightly stepping', () => {
    const w = buildInstalmentPlan({
      totalCents: 9000,
      count: 3,
      frequency: 'weekly',
      firstDueISO: '2026-09-01',
    })
    expect(w.instalments.map((i) => i.dueDate)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15'])

    const f = buildInstalmentPlan({
      totalCents: 9000,
      count: 3,
      frequency: 'fortnightly',
      firstDueISO: '2026-09-01',
    })
    expect(f.instalments.map((i) => i.dueDate)).toEqual(['2026-09-01', '2026-09-15', '2026-09-29'])
  })

  it('month-end clamps (31 Jan → 28 Feb)', () => {
    const p = buildInstalmentPlan({
      totalCents: 30000,
      count: 3,
      frequency: 'monthly',
      firstDueISO: '2026-01-31',
    })
    expect(p.instalments.map((i) => i.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
})
