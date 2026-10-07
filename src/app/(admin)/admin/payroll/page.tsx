import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getPayrollSummary } from '@/lib/rota/payroll-queries'
import { mondayOf, addDays, formatHours } from '@/lib/rota/rota'

export const metadata: Metadata = { title: 'Payroll export | Admin' }
export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const { from: fromP, to: toP } = await searchParams
  const weekStart = mondayOf(new Date())
  const from = fromP && ISO.test(fromP) ? fromP : weekStart
  const to = toP && ISO.test(toP) ? toP : addDays(weekStart, 6)

  const lines = await getPayrollSummary(admin.schoolId, from, to)
  const totalMinutes = lines.reduce((n, l) => n + l.approvedMinutes, 0)
  const downloadHref = `/api/admin/staff/payroll?from=${from}&to=${to}`

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payroll export</h1>
        <p className="mt-1 text-sm text-text-muted">
          Approved timesheet hours per staff member for a pay period. Download the CSV for your
          payroll provider.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="text-text-secondary">From</span>
          <input type="date" name="from" defaultValue={from} className="input-base mt-1" />
        </label>
        <label className="block text-sm">
          <span className="text-text-secondary">To</span>
          <input type="date" name="to" defaultValue={to} className="input-base mt-1" />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          Apply
        </button>
        <a
          href={downloadHref}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Download CSV
        </a>
      </form>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No approved timesheets in this period. Approve timesheets first, then export.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2 text-right">Approved hours</th>
                <th className="px-4 py-2 text-right">Shifts</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.name + (l.email ?? '')} className="border-b border-border/50">
                  <td className="px-4 py-2 font-medium text-text-primary">{l.name}</td>
                  <td className="px-4 py-2 text-text-secondary">{l.email ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">
                    {formatHours(l.approvedMinutes)}
                  </td>
                  <td className="px-4 py-2 text-right text-text-secondary">{l.entries}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="px-4 py-2 text-text-primary" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2 text-right text-text-primary">
                  {formatHours(totalMinutes)}
                </td>
                <td className="px-4 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
