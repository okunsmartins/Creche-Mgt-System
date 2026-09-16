import { describe, it, expect } from 'vitest'
import { csvCell, csvRow, csvEuros, csvDate, buildCsv } from '../utils'

// ─── csvCell — §13.3 formula injection protection ────────────────────────────

describe('csvCell — formula injection protection (§13.3)', () => {
  it.each([
    ['=SUM(A1:A10)', '='],
    ['+1+1', '+'],
    ['-1', '-'],
    ['@cmd|calc', '@'],
    ['\ttab', '\t'],
  ])('prefixes %s (starts with %s) with apostrophe', (input) => {
    const result = csvCell(input)
    expect(result.startsWith("'")).toBe(true)
    expect(result).toContain(input)
  })

  it('leaves plain alphabetic strings untouched', () => {
    expect(csvCell('Hello World')).toBe('Hello World')
  })

  it('leaves numeric strings untouched', () => {
    expect(csvCell('123')).toBe('123')
  })

  it('passes numbers through as strings', () => {
    expect(csvCell(42)).toBe('42')
  })

  it('handles zero', () => {
    expect(csvCell(0)).toBe('0')
  })

  it('returns empty string for null', () => {
    expect(csvCell(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(csvCell(undefined)).toBe('')
  })
})

describe('csvCell — standard CSV quoting', () => {
  it('wraps strings containing commas in double-quotes', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"')
  })

  it('doubles embedded double-quotes per RFC 4180', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps strings containing newlines in double-quotes', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('wraps strings containing carriage returns in double-quotes', () => {
    expect(csvCell('line1\rline2')).toBe('"line1\rline2"')
  })

  it('does not quote a plain string with no special chars', () => {
    const result = csvCell('paid')
    expect(result.startsWith('"')).toBe(false)
    expect(result).toBe('paid')
  })
})

// ─── csvRow ───────────────────────────────────────────────────────────────────

describe('csvRow', () => {
  it('joins cells with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c')
  })

  it('handles mixed types in a single row', () => {
    expect(csvRow(['Alice', 10, null, undefined])).toBe('Alice,10,,')
  })

  it('quotes a cell with a comma while joining correctly', () => {
    expect(csvRow(['Smith, John', 'paid'])).toBe('"Smith, John",paid')
  })

  it('handles an empty cells array', () => {
    expect(csvRow([])).toBe('')
  })
})

// ─── csvEuros ─────────────────────────────────────────────────────────────────

describe('csvEuros', () => {
  it('formats 0 as "0.00"', () => {
    expect(csvEuros(0)).toBe('0.00')
  })

  it('formats 100 cents as "1.00"', () => {
    expect(csvEuros(100)).toBe('1.00')
  })

  it('formats 1050 cents as "10.50"', () => {
    expect(csvEuros(1050)).toBe('10.50')
  })

  it('formats 1 cent as "0.01"', () => {
    expect(csvEuros(1)).toBe('0.01')
  })

  it('formats 199999 cents as "1999.99"', () => {
    expect(csvEuros(199999)).toBe('1999.99')
  })

  it('always produces exactly 2 decimal places', () => {
    expect(csvEuros(500)).toMatch(/^\d+\.\d{2}$/)
  })
})

// ─── csvDate ─────────────────────────────────────────────────────────────────

describe('csvDate', () => {
  it('returns empty string for null', () => {
    expect(csvDate(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(csvDate(undefined)).toBe('')
  })

  it('parses a UTC ISO timestamp and includes the year', () => {
    const result = csvDate('2025-03-15T10:30:00Z')
    expect(result).toMatch(/2025/)
  })

  it('parses an ISO date-only string and includes the year', () => {
    const result = csvDate('2024-06-01T00:00:00Z')
    expect(result).toMatch(/2024/)
  })
})

// ─── buildCsv ────────────────────────────────────────────────────────────────

describe('buildCsv', () => {
  it('produces a header row followed by data rows separated by CRLF', () => {
    const csv = buildCsv(
      ['Name', 'Amount'],
      [
        ['Alice', '10.00'],
        ['Bob', '20.00'],
      ],
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Name,Amount')
    expect(lines[1]).toBe('Alice,10.00')
    expect(lines[2]).toBe('Bob,20.00')
  })

  it('returns only the header row when data is empty', () => {
    expect(buildCsv(['A', 'B'], [])).toBe('A,B')
  })

  it('uses CRLF (\\r\\n) as line endings per RFC 4180', () => {
    const csv = buildCsv(['H'], [['v1'], ['v2']])
    expect(csv).toContain('\r\n')
    expect(csv).not.toContain('\r\n\r\n')
  })

  it('applies formula injection protection to data cells', () => {
    const csv = buildCsv(['Formula'], [['=DANGEROUS()']])
    expect(csv).toContain("'=DANGEROUS()")
  })

  it('quotes header cells containing commas', () => {
    const csv = buildCsv(['First, Last', 'Amount'], [])
    expect(csv.startsWith('"First, Last"')).toBe(true)
  })
})
