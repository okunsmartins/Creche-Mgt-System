import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getTimesheetReport } from '@/lib/rota/timesheet-queries'
import { toCsv } from '@/lib/rota/payroll'
import {
  attendanceRange as periodRange,
  isAttendanceView as isPeriodView,
} from '@/lib/attendance/checkinReport'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const hours = (min: number) => (min / 60).toFixed(2)
const hhmm = (t: string) => t.slice(0, 5)

/** Timesheet report CSV (day / week / month), anchored on `date`. Admin + school-scoped. */
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })

  const sp = request.nextUrl.searchParams
  const view = isPeriodView(sp.get('view') ?? '')
    ? (sp.get('view') as 'day' | 'week' | 'month')
    : 'week'
  const dateParam = sp.get('date')
  const anchor =
    dateParam && ISO.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10)
  const { from, to } = periodRange(view, anchor)
  const report = await getTimesheetReport(admin.schoolId, from, to)

  let rows: (string | number)[][]
  if (view === 'day') {
    rows = [['Date', 'Staff', 'Planned', 'Actual', 'Worked hours', 'Status']]
    for (const e of report.daily)
      rows.push([
        from,
        e.teacherName,
        `${hhmm(e.plannedStart)}-${hhmm(e.plannedEnd)}`,
        `${hhmm(e.actualStart)}-${hhmm(e.actualEnd)}`,
        hours(e.actualMinutes),
        e.status === 'APPROVED' ? 'Approved' : 'Pending',
      ])
  } else {
    rows = [
      [
        'Period start',
        'Period end',
        'Staff',
        'Approved hours',
        'Pending hours',
        'Total hours',
        'Entries',
      ],
    ]
    for (const l of report.lines)
      rows.push([
        from,
        to,
        l.name,
        hours(l.approvedMinutes),
        hours(l.pendingMinutes),
        hours(l.totalMinutes),
        l.entries,
      ])
  }

  const filename = from === to ? `timesheets-${from}.csv` : `timesheets-${from}-to-${to}.csv`
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
