import { describe, it, expect } from 'vitest'
import {
  addDays,
  mondayOf,
  weekDays,
  timeToMinutes,
  shiftMinutes,
  formatHours,
  timesOverlap,
  validateShiftTimes,
} from '../rota'

describe('date helpers', () => {
  it('mondayOf returns the Monday of the week', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05') // Wed → Mon
    expect(mondayOf('2026-10-05')).toBe('2026-10-05') // Mon → Mon
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // Sun → prior Mon
  })
  it('weekDays lists Mon..Sun', () => {
    expect(weekDays('2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
  })
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
})

describe('time + duration', () => {
  it('timeToMinutes parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('17:30:00')).toBe(1050)
    expect(Number.isNaN(timeToMinutes('25:00'))).toBe(true)
    expect(Number.isNaN(timeToMinutes('bad'))).toBe(true)
  })
  it('shiftMinutes computes duration, 0 if invalid/negative', () => {
    expect(shiftMinutes('09:00', '16:30')).toBe(450)
    expect(shiftMinutes('16:00', '09:00')).toBe(0)
    expect(shiftMinutes('x', '09:00')).toBe(0)
  })
  it('formatHours renders tidy hours', () => {
    expect(formatHours(450)).toBe('7.5h')
    expect(formatHours(480)).toBe('8h')
    expect(formatHours(0)).toBe('0h')
  })
})

describe('overlap + validation', () => {
  it('timesOverlap detects overlaps; touching edges do not count', () => {
    expect(timesOverlap('09:00', '13:00', '12:00', '17:00')).toBe(true)
    expect(timesOverlap('09:00', '12:00', '12:00', '17:00')).toBe(false)
    expect(timesOverlap('09:00', '12:00', '13:00', '17:00')).toBe(false)
  })
  it('validateShiftTimes requires a positive range', () => {
    expect(validateShiftTimes('09:00', '17:00')).toBeNull()
    expect(validateShiftTimes('17:00', '09:00')).toMatch(/after/)
    expect(validateShiftTimes('', '09:00')).toMatch(/valid/)
  })
})
