import { describe, it, expect } from 'vitest'
import { isRangeOrdered, timeOffRequestSchema } from '../schemas'

describe('isRangeOrdered', () => {
  it('accepts an end date after the start date', () => {
    expect(isRangeOrdered('2026-09-01', '2026-09-03')).toBe(true)
  })
  it('accepts a same-day range', () => {
    expect(isRangeOrdered('2026-09-01', '2026-09-01')).toBe(true)
  })
  it('rejects an end date before the start date', () => {
    expect(isRangeOrdered('2026-09-03', '2026-09-01')).toBe(false)
  })
})

describe('timeOffRequestSchema', () => {
  it('accepts a valid request and trims the reason', () => {
    const result = timeOffRequestSchema.safeParse({
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      reason: '  Medical appointment  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBe('Medical appointment')
  })

  it('treats an empty reason as undefined', () => {
    const result = timeOffRequestSchema.safeParse({
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      reason: '',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBeUndefined()
  })

  it('rejects an end date before the start date', () => {
    const result = timeOffRequestSchema.safeParse({
      startDate: '2026-09-05',
      endDate: '2026-09-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed date', () => {
    const result = timeOffRequestSchema.safeParse({
      startDate: 'not-a-date',
      endDate: '2026-09-01',
    })
    expect(result.success).toBe(false)
  })
})
