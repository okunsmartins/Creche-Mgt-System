import type { TargetField } from './fields'

// Pure validation for a mapped import (IMP-01). Given the field catalog, the
// user's column mapping and the raw rows, produce per-row normalised values with
// blocking errors and non-blocking warnings — the "preview before we write
// anything" step. No DB access.

/** Mapping: target field key -> source column index (or null = unmapped). */
export type ColumnMapping = Record<string, number | null>

export interface RowResult {
  /** 1-based row number in the source data (excludes the header row). */
  rowNumber: number
  /** Normalised values by field key (null when blank). */
  values: Record<string, string | null>
  errors: string[]
  warnings: string[]
}

export interface ValidationResult {
  rows: RowResult[]
  validCount: number
  errorRowCount: number
  warningRowCount: number
  /** Field keys that are required but not mapped to any column. */
  missingRequired: string[]
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DMY_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

/** Normalise a date string to ISO YYYY-MM-DD, or null if unparseable. */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim()
  if (ISO_DATE.test(s)) {
    const [, y, m, d] = s.match(ISO_DATE)!
    return isRealDate(+y!, +m!, +d!) ? `${y}-${m}-${d}` : null
  }
  const dmy = s.match(DMY_DATE)
  if (dmy) {
    const [, d, m, y] = dmy
    const dd = d!.padStart(2, '0')
    const mm = m!.padStart(2, '0')
    return isRealDate(+y!, +mm, +dd) ? `${y}-${mm}-${dd}` : null
  }
  return null
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cell(row: string[], idx: number | null): string {
  if (idx === null || idx < 0 || idx >= row.length) return ''
  return (row[idx] ?? '').trim()
}

/**
 * Validate mapped rows. `dataRows` excludes the header row. `mapping` maps each
 * field key to a source column index. Blank optional fields are fine; blank
 * required fields error. Type checks: date, email, phone (loose), enum options.
 */
export function validateRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  fields: readonly TargetField[],
): ValidationResult {
  const missingRequired = fields
    .filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined))
    .map((f) => f.key)

  const rows: RowResult[] = dataRows.map((row, i) => {
    const values: Record<string, string | null> = {}
    const errors: string[] = []
    const warnings: string[] = []

    for (const field of fields) {
      const raw = cell(row, mapping[field.key] ?? null)
      if (raw === '') {
        if (field.required) errors.push(`${field.label} is required`)
        values[field.key] = null
        continue
      }
      switch (field.type) {
        case 'date': {
          const iso = normaliseDate(raw)
          if (iso) values[field.key] = iso
          else {
            errors.push(`${field.label} "${raw}" is not a valid date (use DD/MM/YYYY)`)
            values[field.key] = null
          }
          break
        }
        case 'email': {
          values[field.key] = raw
          if (!EMAIL_RE.test(raw))
            warnings.push(`${field.label} "${raw}" doesn't look like an email`)
          break
        }
        case 'enum': {
          const opts = field.options ?? []
          const match = opts.find((o) => o.toLowerCase() === raw.toLowerCase())
          if (match) values[field.key] = match
          else {
            warnings.push(`${field.label} "${raw}" is not one of: ${opts.join(', ')}`)
            values[field.key] = raw
          }
          break
        }
        default:
          values[field.key] = raw
      }
    }

    return { rowNumber: i + 1, values, errors, warnings }
  })

  return {
    rows,
    validCount: rows.filter((r) => r.errors.length === 0).length,
    errorRowCount: rows.filter((r) => r.errors.length > 0).length,
    warningRowCount: rows.filter((r) => r.warnings.length > 0).length,
    missingRequired,
  }
}
