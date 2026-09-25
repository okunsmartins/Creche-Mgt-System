import 'server-only'
import * as XLSX from 'xlsx'
import { parseCsv } from '@/lib/students/csv'

// Server-side spreadsheet parsing for the import wizard. Reads .xlsx or .csv into
// a header row + string rows (first sheet, Phase 1).
//
// Dates are the tricky part: spreadsheet tools silently coerce ambiguous dates
// (e.g. 02/11/2022) into locale-dependent formats. So we DON'T let SheetJS format
// values — CSV is parsed as plain text (values preserved exactly), and for XLSX we
// read real date cells and format them to unambiguous ISO YYYY-MM-DD ourselves.

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  rows: string[][]
}

/** Max data rows accepted in Phase 1 (guards memory + response size). */
export const MAX_IMPORT_ROWS = 2000

function toGrid(headers: string[], dataRows: string[][]): ParsedSheet {
  const rows = dataRows
    .map((r) => headers.map((_, i) => (r[i] ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''))
    .slice(0, MAX_IMPORT_ROWS)
  return { sheetName: '', headers, rows }
}

function parseCsvBuffer(buf: ArrayBuffer): ParsedSheet {
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM
  const grid = parseCsv(text)
  const headers = (grid[0] ?? []).map((h) => h.trim())
  return { ...toGrid(headers, grid.slice(1)), sheetName: 'CSV' }
}

/** Format a JS Date (from an xlsx date cell) as unambiguous ISO YYYY-MM-DD. */
function dateToIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseXlsxBuffer(buf: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { sheetName: '', headers: [], rows: [] }
  const ws = wb.Sheets[sheetName]!
  // raw:true keeps underlying values (strings/numbers/Date) — no locale formatting.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
  const headers = ((grid[0] as unknown[]) ?? []).map((h) => String(h ?? '').trim())
  const rows = grid.slice(1).map((r) =>
    headers.map((_, i) => {
      const v = (r as unknown[])[i]
      if (v instanceof Date) return dateToIso(v)
      return String(v ?? '').trim()
    }),
  )
  return { ...toGrid(headers, rows), sheetName }
}

export function parseSpreadsheet(buf: ArrayBuffer, filename: string): ParsedSheet {
  return filename.toLowerCase().endsWith('.csv') ? parseCsvBuffer(buf) : parseXlsxBuffer(buf)
}
