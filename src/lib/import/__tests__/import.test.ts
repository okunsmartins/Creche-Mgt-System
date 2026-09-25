import { describe, it, expect } from 'vitest'
import { CHILD_FIELDS, autoMap, normaliseHeader } from '../fields'
import { validateRows, normaliseDate, type ColumnMapping } from '../validate'

describe('normaliseHeader', () => {
  it('lowercases and strips punctuation/underscores', () => {
    expect(normaliseHeader('  Child First Name  ')).toBe('child first name')
    expect(normaliseHeader('D.O.B')).toBe('d.o.b'.replace(/[?:.]+$/, '')) // trailing dot stripped
    expect(normaliseHeader('Date_of/Birth')).toBe('date of birth')
  })
})

describe('autoMap', () => {
  it("maps a crèche's own headers onto child fields", () => {
    const headers = ['Child First Name', 'Surname', 'DOB', 'Current Room', 'Locker']
    const m = autoMap(headers, CHILD_FIELDS)
    expect(m['firstName']).toBe(0)
    expect(m['lastName']).toBe(1)
    expect(m['dateOfBirth']).toBe(2)
    expect(m['room']).toBe(3)
  })

  it('leaves unmatched fields null and never reuses a column', () => {
    const headers = ['First', 'Last']
    const m = autoMap(headers, CHILD_FIELDS)
    expect(m['firstName']).toBe(0)
    expect(m['lastName']).toBe(1)
    expect(m['dateOfBirth']).toBeNull()
    const used = Object.values(m).filter((v) => v !== null)
    expect(new Set(used).size).toBe(used.length)
  })
})

describe('normaliseDate', () => {
  it('accepts DD/MM/YYYY and YYYY-MM-DD', () => {
    expect(normaliseDate('14/03/2023')).toBe('2023-03-14')
    expect(normaliseDate('2023-03-14')).toBe('2023-03-14')
    expect(normaliseDate('1/1/2024')).toBe('2024-01-01')
  })
  it('rejects impossible or malformed dates', () => {
    expect(normaliseDate('31/02/2023')).toBeNull()
    expect(normaliseDate('foo')).toBeNull()
    expect(normaliseDate('2023-13-01')).toBeNull()
  })

  it('handles ambiguous DD/MM dates as day/month (regression: 02/11/2022)', () => {
    // Both parts <= 12; must be read as 2 Nov 2022, never coerced to US M/D.
    expect(normaliseDate('02/11/2022')).toBe('2022-11-02')
    expect(normaliseDate('05/06/2021')).toBe('2021-06-05')
  })
})

describe('validateRows', () => {
  const mapping: ColumnMapping = { firstName: 0, lastName: 1, dateOfBirth: 2, status: 3 }

  it('flags missing required mappings', () => {
    const res = validateRows([], { firstName: 0 }, CHILD_FIELDS)
    expect(res.missingRequired).toContain('lastName')
    expect(res.missingRequired).toContain('dateOfBirth')
  })

  it('validates good rows and normalises the date', () => {
    const res = validateRows([['Emma', 'Byrne', '14/03/2023', 'Enrolled']], mapping, CHILD_FIELDS)
    expect(res.validCount).toBe(1)
    expect(res.errorRowCount).toBe(0)
    expect(res.rows[0]!.values['dateOfBirth']).toBe('2023-03-14')
    expect(res.rows[0]!.values['status']).toBe('Enrolled')
  })

  it('errors on blank required and bad date', () => {
    const res = validateRows([['', 'Byrne', 'notadate', 'Enrolled']], mapping, CHILD_FIELDS)
    expect(res.rows[0]!.errors.some((e) => e.includes('first name'))).toBe(true)
    expect(res.rows[0]!.errors.some((e) => e.toLowerCase().includes('valid date'))).toBe(true)
    expect(res.errorRowCount).toBe(1)
    expect(res.validCount).toBe(0)
  })

  it('warns (not errors) on an unknown enum value', () => {
    const res = validateRows([['Liam', 'Walsh', '20/07/2021', 'Registered']], mapping, CHILD_FIELDS)
    expect(res.errorRowCount).toBe(0)
    expect(res.rows[0]!.warnings.some((w) => w.includes('Status'))).toBe(true)
    expect(res.warningRowCount).toBe(1)
  })
})
