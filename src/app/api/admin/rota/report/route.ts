import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getRotaReport } from '@/lib/rota/report-queries'
import { toCsv } from '@/lib/rota/payroll'
import {
  attendanceRange as periodRange,
  isAttendanceView as isPeriodView,
} from '@/lib/attendance/checkinReport'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const hours = (min: number) => (min / 60).toFixed(2)
const hhmm = (t: string) => t.slice(0, 5)

/** Rota (planned shifts) report CSV (day / week / month), anchored on `date`. Admin + school-scoped. */
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
  const report = await getRotaReport(admin.schoolId, from, to)

  let rows: (string | number)[][]
  if (view === 'day') {
    rows = [['Date', 'Staff', 'Room', 'Start', 'End', 'Hours']]
    for (const s of report.shifts)
      rows.push([
        s.date,
        s.teacherName,
        s.roomName ?? '',
        hhmm(s.startTime),
        hhmm(s.endTime),
        hours(s.minutes),
      ])
  } else {
    rows = [['Period start', 'Period end', 'Staff', 'Shifts', 'Planned hours']]
    for (const l of report.byStaff) rows.push([from, to, l.name, l.shifts, hours(l.minutes)])
  }

  const filename = from === to ? `rota-${from}.csv` : `rota-${from}-to-${to}.csv`
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
