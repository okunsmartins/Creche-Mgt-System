import type { Metadata } from 'next'
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
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Timesheets</h1>
        <p className="mt-1 text-sm text-text-muted">
          Generate timesheets from the rota, record the hours actually worked, and approve them.
          Approved hours feed the payroll export.
        </p>
      </div>
      <TimesheetBoard
        week={data}
        prevWeek={addDays(weekStart, -7)}
        nextWeek={addDays(weekStart, 7)}
      />
    </div>
  )
}
