import { describe, it, expect } from 'vitest'
import { addDays, dayMonth, greeting, monthName, shortDayDate, yearOf } from '../live'

describe('live preview dates (Irish time)', () => {
  const d = new Date('2026-11-13T10:00:00Z') // Fri 13 Nov 2026, 10:00 in Dublin

  it('formats today like "Fri 13 Nov"', () => {
    expect(shortDayDate(d)).toBe('Fri 13 Nov')
  })

  it('formats a due date and month/year', () => {
    expect(dayMonth(addDays(d, 8))).toBe('21 Nov')
    expect(monthName(d)).toBe('November')
    expect(yearOf(d)).toBe('2026')
  })

  it('greets by Irish time of day', () => {
    expect(greeting(new Date('2026-11-13T08:00:00Z'))).toBe('Good morning')
    expect(greeting(new Date('2026-11-13T14:00:00Z'))).toBe('Good afternoon')
    expect(greeting(new Date('2026-11-13T19:30:00Z'))).toBe('Good evening')
    // Summer time: 11:30 UTC is 12:30 in Dublin
    expect(greeting(new Date('2026-07-01T11:30:00Z'))).toBe('Good afternoon')
  })

  it('uses the Dublin date, not UTC, around midnight', () => {
    // 23:30 UTC on 30 June = 00:30 on 1 July in Dublin (IST)
    expect(shortDayDate(new Date('2026-06-30T23:30:00Z'))).toBe('Wed 1 Jul')
  })
})
