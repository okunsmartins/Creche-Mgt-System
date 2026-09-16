import { describe, it, expect } from 'vitest'
import { schoolNameConfirmed } from '../schoolGuards'

describe('schoolNameConfirmed', () => {
  it('matches an exact name', () => {
    expect(schoolNameConfirmed('St Mary’s NS', 'St Mary’s NS')).toBe(true)
  })

  it('ignores surrounding whitespace and case', () => {
    expect(schoolNameConfirmed('  st marys ', 'St Marys')).toBe(true)
    expect(schoolNameConfirmed('SCOIL BHRÍDE', 'Scoil Bhríde')).toBe(true)
  })

  it('rejects a non-matching confirmation', () => {
    expect(schoolNameConfirmed('St Marys', 'St Marks')).toBe(false)
    expect(schoolNameConfirmed('', 'St Marys')).toBe(false)
  })

  it('never confirms when the actual name is blank', () => {
    expect(schoolNameConfirmed('', '')).toBe(false)
    expect(schoolNameConfirmed('   ', '   ')).toBe(false)
  })
})
