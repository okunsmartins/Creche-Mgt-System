// §13.3 CSV Export Rules

/**
 * Escape a single CSV cell value.
 * Prefixes formula-injection characters (=, +, -, @) with ' per §13.3.
 * Wraps fields containing commas, quotes, or newlines in double-quotes.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Formula injection protection: prefix cells starting with injection characters
  const safe = /^[=+\-@\t]/.test(s) ? `'${s}` : s
  // Standard CSV quoting
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvCell).join(',')
}

export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)]
  return lines.join('\r\n')
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Prevent caching of sensitive financial reports
      'Cache-Control': 'no-store',
    },
  })
}

/** Format cents as EUR decimal string for CSV (e.g. 1050 → "10.50") */
export function csvEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** ISO date string → Irish display date for CSV */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
