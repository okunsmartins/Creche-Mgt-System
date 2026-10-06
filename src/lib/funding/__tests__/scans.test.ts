import { describe, it, expect } from 'vitest'
import { awardExpiryStatus, readinessDriftDue } from '../scans'

const TODAY = '2026-10-06'

describe('awardExpiryStatus', () => {
  it('is EXPIRED when the award date is before today', () => {
    expect(awardExpiryStatus('2026-10-05', TODAY)).toBe('EXPIRED')
  })

  it('is APPROACHING when within the warning window (inclusive of today and horizon)', () => {
    expect(awardExpiryStatus(TODAY, TODAY)).toBe('APPROACHING')
    expect(awardExpiryStatus('2026-11-05', TODAY, 30)).toBe('APPROACHING') // exactly +30
    expect(awardExpiryStatus('2026-10-20', TODAY, 30)).toBe('APPROACHING')
  })

  it('is NONE when the award is beyond the window', () => {
    expect(awardExpiryStatus('2026-11-06', TODAY, 30)).toBe('NONE') // +31
    expect(awardExpiryStatus('2027-06-01', TODAY)).toBe('NONE')
  })
})

describe('readinessDriftDue', () => {
  it('drifts when MISSING/REVIEW_REQUIRED and the due date is overdue or within window', () => {
    expect(readinessDriftDue('MISSING', '2026-10-01', TODAY)).toBe(true) // overdue
    expect(readinessDriftDue('REVIEW_REQUIRED', '2026-10-14', TODAY, 14)).toBe(true) // +8 within 14
    expect(readinessDriftDue('MISSING', '2026-10-20', TODAY, 14)).toBe(true) // exactly +14
  })

  it('does not drift when the item is current/submitted/not-applicable', () => {
    expect(readinessDriftDue('CURRENT', '2026-10-01', TODAY)).toBe(false)
    expect(readinessDriftDue('SUBMITTED', '2026-10-01', TODAY)).toBe(false)
    expect(readinessDriftDue('NOT_APPLICABLE', '2026-10-01', TODAY)).toBe(false)
  })

  it('does not drift without a due date, or when due is beyond the window', () => {
    expect(readinessDriftDue('MISSING', null, TODAY)).toBe(false)
    expect(readinessDriftDue('MISSING', '2026-10-21', TODAY, 14)).toBe(false) // +15
  })
})
