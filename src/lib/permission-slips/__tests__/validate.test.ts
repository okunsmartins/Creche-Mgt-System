import { describe, it, expect } from 'vitest'
import { isSlipAudience, tallyResponses, dueReminderDate } from '../validate'

describe('dueReminderDate', () => {
  it('returns the local date N days ahead as YYYY-MM-DD', () => {
    expect(dueReminderDate(new Date(2026, 0, 31, 9, 0, 0), 1)).toBe('2026-02-01')
    expect(dueReminderDate(new Date(2026, 5, 15, 23, 0, 0), 0)).toBe('2026-06-15')
    expect(dueReminderDate(new Date(2026, 11, 31, 12, 0, 0), 1)).toBe('2027-01-01')
  })
})

describe('isSlipAudience', () => {
  it('accepts class and school only', () => {
    expect(isSlipAudience('class')).toBe(true)
    expect(isSlipAudience('school')).toBe(true)
    expect(isSlipAudience('student')).toBe(false)
    expect(isSlipAudience('')).toBe(false)
  })
})

describe('tallyResponses', () => {
  it('counts granted/declined and computes pending', () => {
    expect(tallyResponses(5, [{ consent: true }, { consent: true }, { consent: false }])).toEqual({
      total: 5,
      granted: 2,
      declined: 1,
      pending: 2,
    })
  })

  it('never goes negative when responses exceed the roster (e.g. moved pupils)', () => {
    const t = tallyResponses(1, [{ consent: true }, { consent: false }])
    expect(t.pending).toBe(0)
  })

  it('all pending when there are no responses', () => {
    expect(tallyResponses(3, [])).toEqual({ total: 3, granted: 0, declined: 0, pending: 3 })
  })
})
