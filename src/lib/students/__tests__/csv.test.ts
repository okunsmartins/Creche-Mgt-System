import { describe, it, expect } from 'vitest'
import { parseCsv, parseStudentCsv } from '../csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('handles quoted fields with commas', () => {
    expect(parseCsv('"Smith, Jr",John')).toEqual([['Smith, Jr', 'John']])
  })

  it('handles escaped quotes ("")', () => {
    expect(parseCsv('"She said ""hi"""')).toEqual([['She said "hi"']])
  })

  it('handles newlines inside quotes', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']])
  })

  it('normalises CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseStudentCsv', () => {
  it('parses rows by header (any order, aliases)', () => {
    const res = parseStudentCsv('Surname,First Name,Class\nMurphy,Emma,First Class')
    expect(res.error).toBeUndefined()
    expect(res.rows).toEqual([
      { firstName: 'Emma', lastName: 'Murphy', className: 'First Class', line: 2 },
    ])
  })

  it('accepts snake_case headers', () => {
    const res = parseStudentCsv('first_name,last_name,class\nJohn,Brady,Second Class')
    expect(res.rows[0]).toMatchObject({
      firstName: 'John',
      lastName: 'Brady',
      className: 'Second Class',
    })
  })

  it('skips blank lines, trims values, and keeps the TRUE file line number', () => {
    // header = line 1, blank = line 2, data = line 3
    const res = parseStudentCsv('first,last,class\n\n  Ann , Lee ,  Third Class \n')
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({
      firstName: 'Ann',
      lastName: 'Lee',
      className: 'Third Class',
      line: 3,
    })
  })

  it('errors when required columns are missing', () => {
    const res = parseStudentCsv('name,age\nBob,7')
    expect(res.rows).toHaveLength(0)
    expect(res.error).toMatch(/first name, last name and class/i)
  })

  it('errors on an empty file', () => {
    expect(parseStudentCsv('   ').error).toMatch(/empty/i)
  })

  it('reports correct 1-based line numbers', () => {
    const res = parseStudentCsv('first,last,class\nA,B,C\nD,E,F')
    expect(res.rows.map((r) => r.line)).toEqual([2, 3])
  })
})
