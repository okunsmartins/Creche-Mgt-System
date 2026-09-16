// Minimal CSV handling for the student import (Pro feature). Pure + unit-tested.

/**
 * Parse CSV text into a grid of string cells. Handles quoted fields, escaped
 * quotes (""), and commas/newlines inside quotes (RFC-4180-ish). Normalises
 * CRLF/CR to LF first.
 */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < s.length) {
    const c = s[i]!
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  // Flush the trailing field/row (file may not end with a newline).
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export interface ParsedStudentRow {
  firstName: string
  lastName: string
  className: string
  /** 1-based line number in the file (header is line 1). */
  line: number
}

export interface StudentCsvResult {
  rows: ParsedStudentRow[]
  error?: string
}

// Header aliases → canonical field. Headers are normalised to lowercase letters only.
const HEADER_ALIASES: Record<string, 'firstName' | 'lastName' | 'className'> = {
  firstname: 'firstName',
  first: 'firstName',
  forename: 'firstName',
  givenname: 'firstName',
  lastname: 'lastName',
  last: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  class: 'className',
  classname: 'className',
  classroom: 'className',
  group: 'className',
}

function normaliseHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * Parse student-import CSV text into typed rows. The first non-empty line is the
 * header; it must contain first-name, last-name and class columns (various
 * aliases accepted, any order). Blank lines are skipped.
 */
export function parseStudentCsv(text: string): StudentCsvResult {
  // Keep the full grid (don't pre-filter) so reported line numbers match the
  // actual file lines even when blank lines are present.
  const grid = parseCsv(text)
  const isBlank = (r: string[]) => !r.some((c) => c.trim() !== '')

  const headerIdx = grid.findIndex((r) => !isBlank(r))
  if (headerIdx === -1) return { rows: [], error: 'The file is empty.' }

  const header = grid[headerIdx]!.map(normaliseHeader)
  const idx = { firstName: -1, lastName: -1, className: -1 }
  header.forEach((h, i) => {
    const canon = HEADER_ALIASES[h]
    if (canon && idx[canon] === -1) idx[canon] = i
  })

  if (idx.firstName === -1 || idx.lastName === -1 || idx.className === -1) {
    return {
      rows: [],
      error: 'CSV must have a header row with first name, last name and class columns.',
    }
  }

  const rows: ParsedStudentRow[] = []
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const cells = grid[r]!
    if (isBlank(cells)) continue // skip blank lines, but keep true line numbers
    rows.push({
      firstName: (cells[idx.firstName] ?? '').trim(),
      lastName: (cells[idx.lastName] ?? '').trim(),
      className: (cells[idx.className] ?? '').trim(),
      line: r + 1,
    })
  }
  return { rows }
}
