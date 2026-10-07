import { describe, it, expect } from 'vitest'
import {
  isPresent,
  operatingDays,
  summariseByChild,
  toCsv,
  attendanceReportFilename,
  attendanceRange,
  shiftAnchor,
  isAttendanceView,
  type CheckinLite,
} from '../checkinReport'

describe('isPresent', () => {
  it('present only with an arrival time and not marked absent', () => {
    expect(isPresent({ checked_in_at: '2026-10-05T08:00:00Z', status: 'present' })).toBe(true)
    expect(isPresent({ checked_in_at: null, status: 'present' })).toBe(false)
    expect(isPresent({ checked_in_at: '2026-10-05T08:00:00Z', status: 'absent' })).toBe(false)
    expect(isPresent(undefined)).toBe(false)
  })
})

const rows: CheckinLite[] = [
  { student_id: 'a', date: '2026-10-05', checked_in_at: '2026-10-05T08:00:00Z', status: 'present' },
  { student_id: 'b', date: '2026-10-05', checked_in_at: '2026-10-05T09:00:00Z', status: 'present' },
  { student_id: 'a', date: '2026-10-06', checked_in_at: '2026-10-06T08:10:00Z', status: 'present' },
  { student_id: 'b', date: '2026-10-06', checked_in_at: null, status: 'absent' }, // marked absent
]

describe('operatingDays', () => {
  it('counts distinct dates with at least one present child', () => {
    expect(operatingDays(rows)).toEqual(['2026-10-05', '2026-10-06'])
  })
  it('empty when nobody was present', () => {
    expect(
      operatingDays([
        { student_id: 'a', date: '2026-10-07', checked_in_at: null, status: 'expected' },
      ]),
    ).toEqual([])
  })
})

describe('summariseByChild', () => {
  it('counts present/absent against operating days', () => {
    const op = operatingDays(rows) // 2 open days
    const sum = summariseByChild(['a', 'b'], rows, op)
    expect(sum.get('a')).toEqual({ studentId: 'a', present: 2, absent: 0, operating: 2, rate: 100 })
    expect(sum.get('b')).toEqual({ studentId: 'b', present: 1, absent: 1, operating: 2, rate: 50 })
  })
  it('rate is null when no operating days', () => {
    expect(summariseByChild(['a'], [], []).get('a')).toEqual({
      studentId: 'a',
      present: 0,
      absent: 0,
      operating: 0,
      rate: null,
    })
  })
})

describe('attendanceRange', () => {
  it('day = single date', () => {
    expect(attendanceRange('day', '2026-10-07')).toEqual({ from: '2026-10-07', to: '2026-10-07' })
  })
  it('week = Mon–Sun containing the anchor (Wed 2026-10-07)', () => {
    expect(attendanceRange('week', '2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
  })
  it('month = first–last of the anchor month', () => {
    expect(attendanceRange('month', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(attendanceRange('month', '2026-02-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

describe('shiftAnchor + isAttendanceView', () => {
  it('shifts by the period', () => {
    expect(shiftAnchor('day', '2026-10-07', -1)).toBe('2026-10-06')
    expect(shiftAnchor('week', '2026-10-07', 1)).toBe('2026-10-14')
    expect(shiftAnchor('month', '2026-10-07', 1)).toBe('2026-11-01') // month moves normalise to the 1st
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01') // no rollover past February
  })
  it('validates view', () => {
    expect(isAttendanceView('week')).toBe(true)
    expect(isAttendanceView('year')).toBe(false)
  })
})

describe('toCsv + filename', () => {
  it('quotes/escapes cells, CRLF-joined', () => {
    expect(
      toCsv([
        ['Child', 'Rate'],
        ['Say "hi"', 100],
      ]),
    ).toBe('"Child","Rate"\r\n"Say ""hi""","100"')
  })
  it('filename reflects a single day vs a range', () => {
    expect(attendanceReportFilename('2026-10-05', '2026-10-05')).toBe('attendance-2026-10-05.csv')
    expect(attendanceReportFilename('2026-10-05', '2026-10-11')).toBe(
      'attendance-2026-10-05-to-2026-10-11.csv',
    )
  })
})
