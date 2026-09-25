import { describe, it, expect } from 'vitest'
import { generateDueDates, generateFeeSchedule } from '../schedule'

describe('generateDueDates', () => {
  it('weekly across a month', () => {
    const d = generateDueDates('weekly', '2026-01-01', '2026-01-31')
    expect(d).toEqual(['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29'])
  })

  it('fortnightly', () => {
    const d = generateDueDates('fortnightly', '2026-01-01', '2026-02-01')
    expect(d).toEqual(['2026-01-01', '2026-01-15', '2026-01-29'])
  })

  it('monthly for a full year yields 12', () => {
    const d = generateDueDates('monthly', '2026-01-15', '2026-12-31')
    expect(d).toHaveLength(12)
    expect(d[0]).toBe('2026-01-15')
    expect(d[11]).toBe('2026-12-15')
  })

  it('monthly clamps to month end (31 Jan → 28 Feb)', () => {
    const d = generateDueDates('monthly', '2026-01-31', '2026-03-31')
    expect(d).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('annually yields one per year', () => {
    expect(generateDueDates('annually', '2026-09-01', '2027-06-30')).toEqual(['2026-09-01'])
  })

  it('empty when start is after end', () => {
    expect(generateDueDates('weekly', '2026-02-01', '2026-01-01')).toEqual([])
  })
})

describe('generateFeeSchedule', () => {
  it('produces equal obligations that sum to the total', () => {
    const s = generateFeeSchedule({
      frequency: 'monthly',
      startISO: '2026-01-01',
      endISO: '2026-12-31',
      amountPerPeriodCents: 24000,
    })
    expect(s.count).toBe(12)
    expect(s.totalCents).toBe(24000 * 12)
    expect(s.obligations.every((o) => o.amountCents === 24000)).toBe(true)
    expect(s.obligations[0]!.dueDate).toBe('2026-01-01')
  })

  it('models a weekly term fee (the magic-wand year view)', () => {
    const s = generateFeeSchedule({
      frequency: 'weekly',
      startISO: '2026-09-01',
      endISO: '2026-09-29',
      amountPerPeriodCents: 9650, // e.g. FEE-05 net €96.50/week
    })
    expect(s.count).toBe(5)
    expect(s.totalCents).toBe(48250)
  })
})
