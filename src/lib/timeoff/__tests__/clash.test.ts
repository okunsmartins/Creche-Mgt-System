import { describe, it, expect } from 'vitest'
import { datesOverlap, overlappingLeave, clashDaysInRange, type LeaveInterval } from '../clash'

describe('datesOverlap', () => {
  it('detects overlapping and adjacent/disjoint inclusive ranges', () => {
    expect(datesOverlap('2026-10-05', '2026-10-09', '2026-10-08', '2026-10-12')).toBe(true)
    expect(datesOverlap('2026-10-05', '2026-10-09', '2026-10-09', '2026-10-12')).toBe(true) // touch
    expect(datesOverlap('2026-10-05', '2026-10-09', '2026-10-10', '2026-10-12')).toBe(false)
  })
})

const leave: LeaveInterval[] = [
  { teacherId: 'a', name: 'Ann', start: '2026-10-12', end: '2026-10-16' },
  { teacherId: 'b', name: 'Bea', start: '2026-10-14', end: '2026-10-15' },
  { teacherId: 'c', name: 'Cat', start: '2026-10-20', end: '2026-10-20' },
]

describe('overlappingLeave', () => {
  it('returns other staff whose leave overlaps the target', () => {
    const o = overlappingLeave(leave[0]!, leave)
    expect(o.map((x) => x.name)).toEqual(['Bea'])
  })
  it('excludes the same teacher', () => {
    expect(overlappingLeave(leave[0]!, [leave[0]!])).toEqual([])
  })
})

describe('clashDaysInRange', () => {
  it('flags days where 2+ distinct staff are off', () => {
    const days = clashDaysInRange(leave, '2026-10-12', '2026-10-21')
    expect(days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15'])
    expect(days[0]!.names.sort()).toEqual(['Ann', 'Bea'])
  })
  it('empty when nobody overlaps', () => {
    expect(clashDaysInRange([leave[2]!], '2026-10-12', '2026-10-25')).toEqual([])
  })
})
