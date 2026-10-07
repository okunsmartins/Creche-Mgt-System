import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart2 } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { getWeekTimesheets } from '@/lib/rota/timesheet-queries'
import { mondayOf, addDays } from '@/lib/rota/rota'
import { TimesheetBoard } from '@/components/rota/TimesheetBoard'

export const metadata: Metadata = { title: 'Timesheets | Admin' }
export const dynamic = 'force-dynamic'

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const { week } = await searchParams
  const weekStart = mondayOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : new Date())
  const data = await getWeekTimesheets(admin.schoolId, weekStart)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Timesheets</h1>
          <p className="mt-1 text-sm text-text-muted">
            Generate timesheets from the rota, record the hours actually worked, and approve them.
            Approved hours feed the payroll export.
          </p>
        </div>
        <Link
          href="/admin/timesheets/report"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          <BarChart2 className="h-4 w-4" /> Report
        </Link>
      </div>
      <TimesheetBoard
        week={data}
        prevWeek={addDays(weekStart, -7)}
        nextWeek={addDays(weekStart, 7)}
      />
    </div>
  )
}
