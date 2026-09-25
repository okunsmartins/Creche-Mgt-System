import { describe, it, expect } from 'vitest'
import {
  requiredStaff,
  assessRatio,
  ratioSeverity,
  ratioBandForAgeMonths,
} from '../ratio'

describe('requiredStaff', () => {
  it('rounds up and handles zero', () => {
    expect(requiredStaff(0, 3)).toBe(0)
    expect(requiredStaff(10, 3)).toBe(4)
    expect(requiredStaff(10, 5)).toBe(2)
    expect(requiredStaff(6, 6)).toBe(1)
    expect(requiredStaff(7, 6)).toBe(2)
  })
  it('clamps a nonsensical ratio to >= 1', () => {
    expect(requiredStaff(5, 0)).toBe(5)
  })
})

describe('assessRatio', () => {
  it('reports met with spare capacity', () => {
    const a = assessRatio(8, 2, 5) // need ceil(8/5)=2, have 2
    expect(a.requiredStaff).toBe(2)
    expect(a.met).toBe(true)
    expect(a.shortfallStaff).toBe(0)
    expect(a.spareChildCapacity).toBe(2) // 2*5 - 8
  })
  it('reports a breach with shortfall', () => {
    const a = assessRatio(16, 2, 5) // need 4, have 2
    expect(a.met).toBe(false)
    expect(a.shortfallStaff).toBe(2)
    expect(a.spareChildCapacity).toBe(0)
  })
})

describe('ratioSeverity', () => {
  it('classifies breach / at_capacity / ok', () => {
    expect(ratioSeverity(assessRatio(16, 2, 5))).toBe('breach')
    expect(ratioSeverity(assessRatio(10, 2, 5))).toBe('at_capacity')
    expect(ratioSeverity(assessRatio(4, 2, 5))).toBe('ok')
    expect(ratioSeverity(assessRatio(0, 1, 5))).toBe('ok')
  })
})

describe('ratioBandForAgeMonths (reference)', () => {
  it('picks the right band or null', () => {
    expect(ratioBandForAgeMonths(6)?.childrenPerAdult).toBe(3)
    expect(ratioBandForAgeMonths(18)?.childrenPerAdult).toBe(5)
    expect(ratioBandForAgeMonths(40)?.childrenPerAdult).toBe(8)
    expect(ratioBandForAgeMonths(200)).toBeNull()
  })
})
