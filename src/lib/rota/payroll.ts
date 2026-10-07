// Payroll export — pure helpers. Payroll is derived from APPROVED timesheet hours for a
// pay period; this file builds the CSV and the filename. The aggregation query lives in
// payroll-queries.ts.

/** A payroll line for one staff member over the period. */
export interface PayrollLine {
  name: string
  email: string | null
  approvedMinutes: number
  entries: number
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

/** Serialise rows to CSV (CRLF line endings, every cell quoted). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Build the payroll CSV for a period: one row per staff member, hours to 2 dp. */
export function buildPayrollCsv(from: string, to: string, lines: PayrollLine[]): string {
  const header = ['Period start', 'Period end', 'Staff', 'Email', 'Approved hours', 'Shifts']
  const body = lines.map((l) => [
    from,
    to,
    l.name,
    l.email ?? '',
    (l.approvedMinutes / 60).toFixed(2),
    l.entries,
  ])
  return toCsv([header, ...body])
}

export function payrollFilename(from: string, to: string): string {
  return `payroll-${from}-to-${to}.csv`
}
