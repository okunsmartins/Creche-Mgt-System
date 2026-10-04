import { describe, it, expect } from 'vitest'
import {
  toISODate,
  addDays,
  reportingWeekStart,
  previousWeekStart,
  weekDates,
  weekEnd,
  latestCompletedWeekStart,
} from '../week'

describe('reporting-week helpers', () => {
  it('reportingWeekStart returns the Monday of the week', () => {
    // 2026-10-03 is a Saturday → Monday is 2026-09-28.
    expect(reportingWeekStart('2026-10-03')).toBe('2026-09-28')
    // Monday maps to itself.
    expect(reportingWeekStart('2026-09-28')).toBe('2026-09-28')
    // Sunday belongs to the week that started the previous Monday.
    expect(reportingWeekStart('2026-10-04')).toBe('2026-09-28')
  })

  it('addDays / previousWeekStart / weekEnd', () => {
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04')
    expect(previousWeekStart('2026-09-28')).toBe('2026-09-21')
    expect(weekEnd('2026-09-28')).toBe('2026-10-04')
  })

  it('weekDates lists Monday..Sunday', () => {
    expect(weekDates('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  it('latestCompletedWeekStart is the week before the current one', () => {
    // now = Wed 2026-09-30 → current week starts 2026-09-28 → completed = 2026-09-21.
    expect(latestCompletedWeekStart(new Date('2026-09-30T09:00:00Z'))).toBe('2026-09-21')
  })

  it('toISODate formats in UTC', () => {
    expect(toISODate(new Date('2026-09-28T23:30:00Z'))).toBe('2026-09-28')
  })
})
