import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getStaffAttendanceReport } from '@/lib/staff-attendance/queries'
import { toCsv } from '@/lib/rota/payroll'
import {
  attendanceRange as periodRange,
  isAttendanceView as isPeriodView,
} from '@/lib/attendance/checkinReport'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const hours = (min: number) => (min / 60).toFixed(2)
function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Dublin',
  })
}

/** Staff attendance (clock-in/out) report CSV — day / week / month. Admin + school-scoped. */
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
  const report = await getStaffAttendanceReport(admin.schoolId, from, to)

  let rows: (string | number)[][]
  if (view === 'day') {
    rows = [['Date', 'Staff', 'Clock in', 'Clock out', 'Hours worked']]
    for (const e of report.daily)
      rows.push([
        from,
        e.teacherName,
        fmtTime(e.clockInAt),
        fmtTime(e.clockOutAt),
        hours(e.minutes),
      ])
  } else {
    rows = [['Period start', 'Period end', 'Staff', 'Days', 'Hours worked']]
    for (const l of report.lines) rows.push([from, to, l.name, l.days, hours(l.minutes)])
  }

  const filename =
    from === to ? `staff-attendance-${from}.csv` : `staff-attendance-${from}-to-${to}.csv`
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
