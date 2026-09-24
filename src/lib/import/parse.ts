import 'server-only'
import * as XLSX from 'xlsx'

// Server-side spreadsheet parsing for the import wizard. Reads .xlsx or .csv into
// a header row + string rows (first sheet, Phase 1). Values are stringified and
// trimmed; fully-blank rows are dropped.

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  rows: string[][]
}

/** Max data rows accepted in Phase 1 (guards memory + response size). */
export const MAX_IMPORT_ROWS = 2000

export function parseWorkbook(buf: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { sheetName: '', headers: [], rows: [] }
  const ws = wb.Sheets[sheetName]!
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })

  const headers = ((grid[0] as unknown[]) ?? []).map((h) => String(h ?? '').trim())
  const rows = grid
    .slice(1)
    .map((r) => headers.map((_, i) => String(((r as unknown[])[i] ?? '') as unknown).trim()))
    .filter((r) => r.some((c) => c !== ''))
    .slice(0, MAX_IMPORT_ROWS)

  return { sheetName, headers, rows }
}
