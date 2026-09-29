import { describe, it, expect } from 'vitest'
import {
  ageInDaysAt,
  ageInWeeksAt,
  ageInMonthsAt,
  ageInYearsAt,
  ncsAgeEligibility,
  ageLabel,
} from '../age'

describe('age arithmetic', () => {
  it('days / weeks', () => {
    expect(ageInDaysAt('2026-01-01', '2026-01-15')).toBe(14)
    expect(ageInWeeksAt('2026-01-01', '2026-01-15')).toBe(2)
    expect(ageInWeeksAt('2026-01-01', '2026-01-14')).toBe(1) // 13 days → 1 completed week
  })

  it('months clamps on day-of-month', () => {
    expect(ageInMonthsAt('2026-01-15', '2026-03-15')).toBe(2)
    expect(ageInMonthsAt('2026-01-15', '2026-03-14')).toBe(1) // day not reached
    expect(ageInMonthsAt('2024-02-29', '2026-02-28')).toBe(23) // leap-year birthday not yet reached
  })

  it('years', () => {
    expect(ageInYearsAt('2020-06-01', '2026-05-31')).toBe(5)
    expect(ageInYearsAt('2020-06-01', '2026-06-01')).toBe(6)
  })

  it('never negative before birth', () => {
    expect(ageInDaysAt('2026-06-01', '2026-01-01')).toBe(0)
    expect(ageInMonthsAt('2026-06-01', '2026-01-01')).toBe(0)
  })
})

describe('ncsAgeEligibility (age gate only)', () => {
  const cfg = { minAgeWeeks: 24, maxAgeYears: 15 }

  it('too young (under 24 weeks)', () => {
    const r = ncsAgeEligibility('2026-01-01', '2026-05-01', cfg) // ~17 weeks
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/24 weeks/)
  })

  it('eligible in-band', () => {
    const r = ncsAgeEligibility('2023-01-01', '2026-09-01', cfg) // ~3.6y
    expect(r.eligible).toBe(true)
    expect(r.ageYears).toBe(3)
  })

  it('exactly 24 weeks is eligible (boundary)', () => {
    expect(ncsAgeEligibility('2026-01-01', '2026-06-18', cfg).eligible).toBe(true) // 168 days = 24w
  })

  it('aged out at 15', () => {
    const r = ncsAgeEligibility('2011-01-01', '2026-01-01', cfg) // exactly 15y
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/Aged out/)
  })
})

describe('ageLabel', () => {
  it('formats months then years', () => {
    expect(ageLabel('2026-01-01', '2026-07-01')).toBe('6m')
    expect(ageLabel('2024-01-01', '2026-01-01')).toBe('2y')
    expect(ageLabel('2024-01-01', '2026-04-01')).toBe('2y 3m')
  })
})
