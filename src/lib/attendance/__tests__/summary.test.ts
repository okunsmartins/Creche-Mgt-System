import { describe, it, expect } from 'vitest'
import {
  computeAttendanceRate,
  aggregateAttendance,
  toDateString,
  getWeekRange,
  getMonthRange,
  resolveDateRange,
  resolveGranularity,
  periodKey,
  periodLabel,
  aggregateByPeriod,
  latestFlags,
  type RosterStudent,
  type RawAttendanceRecord,
  type DatedRecord,
  type AttendanceFlag,
} from '../summary'

describe('latestFlags', () => {
  const flags: AttendanceFlag[] = [
    { date: '2026-01-10', status: 'absent', note: null },
    { date: '2026-03-02', status: 'late', note: 'bus' },
    { date: '2026-02-01', status: 'absent', note: null },
  ]

  it('orders newest first and caps at the limit', () => {
    expect(latestFlags(flags, 2).map((f) => f.date)).toEqual(['2026-03-02', '2026-02-01'])
  })

  it('returns all when under the limit and does not mutate the input', () => {
    const out = latestFlags(flags, 10)
    expect(out).toHaveLength(3)
    expect(flags[0]!.date).toBe('2026-01-10')
  })
})

// ─── computeAttendanceRate ────────────────────────────────────────────────────

describe('computeAttendanceRate', () => {
  it('counts late as present (full attendance with only late)', () => {
    expect(computeAttendanceRate(0, 5, 0)).toBe(100)
  })

  it('counts present + late in the numerator', () => {
    // 8 present + 1 late out of 10 = 90%
    expect(computeAttendanceRate(8, 1, 1)).toBe(90)
  })

  it('only absences reduce the rate', () => {
    expect(computeAttendanceRate(9, 0, 1)).toBe(90)
    expect(computeAttendanceRate(0, 9, 1)).toBe(90)
  })

  it('returns 100 when never absent', () => {
    expect(computeAttendanceRate(10, 0, 0)).toBe(100)
  })

  it('returns 0 when always absent', () => {
    expect(computeAttendanceRate(0, 0, 5)).toBe(0)
  })

  it('returns null when there are no records', () => {
    expect(computeAttendanceRate(0, 0, 0)).toBeNull()
  })

  it('rounds to a whole number', () => {
    // 2 of 3 = 66.67 → 67
    expect(computeAttendanceRate(2, 0, 1)).toBe(67)
  })
})

// ─── aggregateAttendance ──────────────────────────────────────────────────────

const ROSTER: RosterStudent[] = [
  { id: 's1', first_name: 'Aoife', last_name: 'Murphy' },
  { id: 's2', first_name: 'Ciarán', last_name: "O'Brien" },
  { id: 's3', first_name: 'Siobhán', last_name: 'Kelly' },
]

describe('aggregateAttendance', () => {
  it('tallies each status per student', () => {
    const records: RawAttendanceRecord[] = [
      { student_id: 's1', status: 'present' },
      { student_id: 's1', status: 'late' },
      { student_id: 's1', status: 'absent' },
      { student_id: 's2', status: 'present' },
      { student_id: 's2', status: 'present' },
    ]
    const result = aggregateAttendance(ROSTER, records)
    const s1 = result.find((r) => r.studentId === 's1')!
    expect(s1).toMatchObject({ present: 1, late: 1, absent: 1, totalMarked: 3, attendanceRate: 67 })
    const s2 = result.find((r) => r.studentId === 's2')!
    expect(s2).toMatchObject({
      present: 2,
      late: 0,
      absent: 0,
      totalMarked: 2,
      attendanceRate: 100,
    })
  })

  it('includes roster students with no records (rate null)', () => {
    const result = aggregateAttendance(ROSTER, [])
    const s3 = result.find((r) => r.studentId === 's3')!
    expect(s3).toMatchObject({
      present: 0,
      late: 0,
      absent: 0,
      totalMarked: 0,
      attendanceRate: null,
    })
  })

  it('ignores records for students not on the roster', () => {
    const records: RawAttendanceRecord[] = [{ student_id: 'ghost', status: 'present' }]
    const result = aggregateAttendance(ROSTER, records)
    expect(result).toHaveLength(3)
    expect(result.every((r) => r.totalMarked === 0)).toBe(true)
  })

  it('preserves roster order', () => {
    const result = aggregateAttendance(ROSTER, [])
    expect(result.map((r) => r.studentId)).toEqual(['s1', 's2', 's3'])
  })
})

// ─── date helpers ─────────────────────────────────────────────────────────────

describe('toDateString', () => {
  it('formats with local components, no timezone shift', () => {
    expect(toDateString(new Date(2026, 5, 22))).toBe('2026-06-22') // month is 0-indexed
  })

  it('zero-pads month and day', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getWeekRange', () => {
  it('returns Monday–Sunday for a mid-week date', () => {
    // 2026-06-24 is a Wednesday
    const { from, to } = getWeekRange(new Date(2026, 5, 24))
    expect(from).toBe('2026-06-22') // Monday
    expect(to).toBe('2026-06-28') // Sunday
  })

  it('handles a Sunday correctly (stays in the same week)', () => {
    // 2026-06-28 is a Sunday
    const { from, to } = getWeekRange(new Date(2026, 5, 28))
    expect(from).toBe('2026-06-22')
    expect(to).toBe('2026-06-28')
  })

  it('handles a Monday correctly', () => {
    const { from, to } = getWeekRange(new Date(2026, 5, 22))
    expect(from).toBe('2026-06-22')
    expect(to).toBe('2026-06-28')
  })
})

describe('getMonthRange', () => {
  it('returns first and last day of the month', () => {
    const { from, to } = getMonthRange(new Date(2026, 5, 15))
    expect(from).toBe('2026-06-01')
    expect(to).toBe('2026-06-30')
  })

  it('handles February in a non-leap year', () => {
    const { from, to } = getMonthRange(new Date(2026, 1, 10))
    expect(from).toBe('2026-02-01')
    expect(to).toBe('2026-02-28')
  })
})

describe('resolveDateRange', () => {
  const ref = new Date(2026, 5, 15)

  it('returns the given range when valid', () => {
    expect(resolveDateRange('2026-06-01', '2026-06-10', ref)).toEqual({
      from: '2026-06-01',
      to: '2026-06-10',
    })
  })

  it('falls back to the current month when params are missing', () => {
    expect(resolveDateRange(undefined, undefined, ref)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('falls back when a date is malformed', () => {
    expect(resolveDateRange('not-a-date', '2026-06-10', ref)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('falls back when from is after to', () => {
    expect(resolveDateRange('2026-06-20', '2026-06-10', ref)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })
})

// ─── Phase 2: period rollups ──────────────────────────────────────────────────

describe('resolveGranularity', () => {
  it('returns week when explicitly week', () => {
    expect(resolveGranularity('week')).toBe('week')
  })

  it('defaults to month for anything else', () => {
    expect(resolveGranularity('month')).toBe('month')
    expect(resolveGranularity(undefined)).toBe('month')
    expect(resolveGranularity('nonsense')).toBe('month')
  })
})

describe('periodKey', () => {
  it('returns YYYY-MM for month granularity', () => {
    expect(periodKey('2026-06-22', 'month')).toBe('2026-06')
  })

  it('returns the Monday of the week for week granularity', () => {
    // 2026-06-24 is a Wednesday → Monday is 2026-06-22
    expect(periodKey('2026-06-24', 'week')).toBe('2026-06-22')
    // Sunday stays in the same week
    expect(periodKey('2026-06-28', 'week')).toBe('2026-06-22')
    // Monday maps to itself
    expect(periodKey('2026-06-22', 'week')).toBe('2026-06-22')
  })

  it('handles a week spanning a month boundary', () => {
    // 2026-07-01 is a Wednesday → Monday is 2026-06-29
    expect(periodKey('2026-07-01', 'week')).toBe('2026-06-29')
  })
})

describe('periodLabel', () => {
  it('labels a month key', () => {
    expect(periodLabel('2026-06', 'month')).toBe('June 2026')
  })

  it('labels a week key by its Monday', () => {
    expect(periodLabel('2026-06-22', 'week')).toBe('Week of 22 Jun')
  })
})

describe('aggregateByPeriod', () => {
  const records: DatedRecord[] = [
    { date: '2026-06-01', status: 'present' }, // week of 2026-06-01, month 2026-06
    { date: '2026-06-01', status: 'absent' },
    { date: '2026-06-08', status: 'present' }, // week of 2026-06-08
    { date: '2026-06-08', status: 'late' },
    { date: '2026-07-06', status: 'present' }, // month 2026-07
  ]

  it('groups by month with class-wide rate (late = present)', () => {
    const result = aggregateByPeriod(records, 'month')
    expect(result).toHaveLength(2)
    const june = result[0]!
    expect(june.key).toBe('2026-06')
    expect(june).toMatchObject({ present: 2, late: 1, absent: 1, sessionCount: 2 })
    // (2 present + 1 late) / 4 = 75%
    expect(june.attendanceRate).toBe(75)
    const july = result[1]!
    expect(july).toMatchObject({
      key: '2026-07',
      present: 1,
      late: 0,
      absent: 0,
      attendanceRate: 100,
    })
  })

  it('groups by week', () => {
    const result = aggregateByPeriod(records, 'week')
    expect(result.map((p) => p.key)).toEqual(['2026-06-01', '2026-06-08', '2026-07-06'])
    const w1 = result[0]!
    expect(w1).toMatchObject({ present: 1, absent: 1, sessionCount: 1, attendanceRate: 50 })
    const w2 = result[1]!
    // 1 present + 1 late, no absent → 100%
    expect(w2).toMatchObject({ present: 1, late: 1, attendanceRate: 100 })
  })

  it('returns chronologically sorted periods', () => {
    const shuffled: DatedRecord[] = [
      { date: '2026-08-10', status: 'present' },
      { date: '2026-05-04', status: 'present' },
      { date: '2026-06-15', status: 'present' },
    ]
    expect(aggregateByPeriod(shuffled, 'month').map((p) => p.key)).toEqual([
      '2026-05',
      '2026-06',
      '2026-08',
    ])
  })

  it('counts distinct session dates, not records', () => {
    const sameDay: DatedRecord[] = [
      { date: '2026-06-22', status: 'present' },
      { date: '2026-06-22', status: 'absent' },
      { date: '2026-06-22', status: 'late' },
    ]
    const [period] = aggregateByPeriod(sameDay, 'month')
    expect(period!.sessionCount).toBe(1)
  })

  it('returns an empty array for no records', () => {
    expect(aggregateByPeriod([], 'month')).toEqual([])
  })
})
