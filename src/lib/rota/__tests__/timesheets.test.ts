import { describe, it, expect } from 'vitest'
import {
  TIMESHEET_STATUSES,
  isTimesheetStatus,
  actualMinutes,
  varianceMinutes,
  formatVariance,
} from '../timesheets'

describe('timesheet status', () => {
  it('has PENDING and APPROVED', () => {
    expect(TIMESHEET_STATUSES).toEqual(['PENDING', 'APPROVED'])
    expect(isTimesheetStatus('APPROVED')).toBe(true)
    expect(isTimesheetStatus('nope')).toBe(false)
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
