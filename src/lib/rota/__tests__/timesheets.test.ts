import { describe, it, expect } from 'vitest'
import {
  TIMESHEET_STATUSES,
  isTimesheetStatus,
  actualMinutes,
  varianceMinutes,
  formatVariance,
  normalizeTime,
  actualTimesChanged,
  summariseTimesheets,
} from '../timesheets'

describe('timesheet status', () => {
  it('has PENDING and APPROVED', () => {
    expect(TIMESHEET_STATUSES).toEqual(['PENDING', 'APPROVED'])
    expect(isTimesheetStatus('APPROVED')).toBe(true)
    expect(isTimesheetStatus('nope')).toBe(false)
  })
})

describe('normalizeTime + actualTimesChanged', () => {
  it('normalises HH:MM:SS and HH:MM to HH:MM', () => {
    expect(normalizeTime('09:00:00')).toBe('09:00')
    expect(normalizeTime('09:00')).toBe('09:00')
  })
  it('detects a change at minute precision, ignoring seconds', () => {
    expect(actualTimesChanged('09:00:00', '17:00:00', '09:00', '17:00')).toBe(false)
    expect(actualTimesChanged('09:00:00', '17:00:00', '09:15', '17:00')).toBe(true)
    expect(actualTimesChanged('09:00:00', '17:00:00', '09:00', '16:30')).toBe(true)
  })
})

describe('actualMinutes', () => {
  it('computes worked minutes', () => {
    expect(actualMinutes('09:00', '16:30')).toBe(450)
    expect(actualMinutes('bad', '16:30')).toBe(0)
  })
})

describe('varianceMinutes + formatVariance', () => {
  it('positive when worked more than planned', () => {
    const v = varianceMinutes('09:00', '17:00', '09:00', '17:30') // +30
    expect(v).toBe(30)
    expect(formatVariance(v)).toBe('+0.5h')
  })
  it('negative when worked less than planned', () => {
    const v = varianceMinutes('09:00', '17:00', '09:00', '16:00') // -60
    expect(v).toBe(-60)
    expect(formatVariance(v)).toBe('-1h')
  })
  it('on plan when equal', () => {
    const v = varianceMinutes('09:00', '17:00', '09:00', '17:00')
    expect(v).toBe(0)
    expect(formatVariance(v)).toBe('on plan')
  })
})

describe('summariseTimesheets', () => {
  it('aggregates approved vs pending hours per staff, sorted by name', () => {
    const lines = summariseTimesheets([
      { teacherId: 'b', name: 'Bea', status: 'APPROVED', actualStart: '09:00', actualEnd: '17:00' }, // 480
      { teacherId: 'b', name: 'Bea', status: 'PENDING', actualStart: '09:00', actualEnd: '12:00' }, // 180
      { teacherId: 'a', name: 'Ann', status: 'APPROVED', actualStart: '09:00', actualEnd: '13:00' }, // 240
    ])
    expect(lines.map((l) => l.name)).toEqual(['Ann', 'Bea'])
    expect(lines[1]).toEqual({
      teacherId: 'b',
      name: 'Bea',
      approvedMinutes: 480,
      pendingMinutes: 180,
      totalMinutes: 660,
      entries: 2,
    })
    expect(lines[0]?.approvedMinutes).toBe(240)
  })
})
