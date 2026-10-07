import { describe, it, expect } from 'vitest'
import { clockState, workedMinutes, summariseStaffWork } from '../clocking'

describe('clockState', () => {
  it('reflects not_in / in / out', () => {
    expect(clockState(undefined)).toBe('not_in')
    expect(clockState({ clock_in_at: null, clock_out_at: null })).toBe('not_in')
    expect(clockState({ clock_in_at: '2026-10-07T08:00:00Z', clock_out_at: null })).toBe('in')
    expect(
      clockState({ clock_in_at: '2026-10-07T08:00:00Z', clock_out_at: '2026-10-07T16:00:00Z' }),
    ).toBe('out')
  })
})

describe('workedMinutes', () => {
  it('is 0 unless both set and ordered', () => {
    expect(workedMinutes('2026-10-07T08:00:00Z', null)).toBe(0)
    expect(workedMinutes(null, '2026-10-07T16:00:00Z')).toBe(0)
    expect(workedMinutes('2026-10-07T16:00:00Z', '2026-10-07T08:00:00Z')).toBe(0)
    expect(workedMinutes('2026-10-07T08:00:00Z', '2026-10-07T16:30:00Z')).toBe(510)
  })
})

describe('summariseStaffWork', () => {
  it('sums worked minutes + completed days per staff, sorted by name', () => {
    const lines = summariseStaffWork([
      {
        teacherId: 'b',
        name: 'Bea',
        clockInAt: '2026-10-05T08:00:00Z',
        clockOutAt: '2026-10-05T16:00:00Z',
      }, // 480
      { teacherId: 'b', name: 'Bea', clockInAt: '2026-10-06T08:00:00Z', clockOutAt: null }, // 0, no day
      {
        teacherId: 'a',
        name: 'Ann',
        clockInAt: '2026-10-05T09:00:00Z',
        clockOutAt: '2026-10-05T13:00:00Z',
      }, // 240
    ])
    expect(lines.map((l) => l.name)).toEqual(['Ann', 'Bea'])
    expect(lines[1]).toEqual({ teacherId: 'b', name: 'Bea', minutes: 480, days: 1 })
    expect(lines[0]!.minutes).toBe(240)
  })
})
