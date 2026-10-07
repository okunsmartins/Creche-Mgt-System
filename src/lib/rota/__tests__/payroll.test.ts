import { describe, it, expect } from 'vitest'
import { toCsv, buildPayrollCsv, payrollFilename } from '../payroll'

describe('toCsv', () => {
  it('quotes every cell and escapes quotes, CRLF-joined', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c"d', 1],
      ]),
    ).toBe('"a","b"\r\n"c""d","1"')
  })
})

describe('buildPayrollCsv', () => {
  it('has a header and one row per staff line, hours to 2dp', () => {
    const csv = buildPayrollCsv('2026-10-05', '2026-10-11', [
      { name: 'Sean Byrne', email: 'sean@x.ie', approvedMinutes: 450, entries: 1 },
      { name: 'Aoife Doyle', email: null, approvedMinutes: 2400, entries: 5 },
    ])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Approved hours')
    expect(lines[1]).toContain('"7.50"')
    expect(lines[1]).toContain('"Sean Byrne"')
    expect(lines[2]).toContain('"40.00"')
    expect(lines[2]).toContain('""') // null email → empty
  })
})

describe('payrollFilename', () => {
  it('includes the period', () => {
    expect(payrollFilename('2026-10-05', '2026-10-11')).toBe('payroll-2026-10-05-to-2026-10-11.csv')
  })
})
