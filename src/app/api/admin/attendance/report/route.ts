import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { getAttendanceReport } from '@/lib/attendance/checkin-queries'
import {
  attendanceRange,
  attendanceReportFilename,
  isAttendanceView,
  toCsv,
} from '@/lib/attendance/checkinReport'

const ISO = /^\d{4}-\d{2}-\d{2}$/

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

/**
 * Attendance report CSV derived from daily check-ins. Admin + school-scoped; Pro-gated
 * (matches the in-app export). `view` = day | week | month, anchored on `date`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })
  if (!(await schoolHasProAccess(admin.schoolId)))
    return new Response('CSV export is a Pro feature.', { status: 403 })

  const sp = request.nextUrl.searchParams
  const view = isAttendanceView(sp.get('view') ?? '')
    ? (sp.get('view') as 'day' | 'week' | 'month')
    : 'week'
  const dateParam = sp.get('date')
  const anchor =
    dateParam && ISO.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10)
  const { from, to } = attendanceRange(view, anchor)

  const report = await getAttendanceReport(admin.schoolId, from, to)

  let rows: (string | number)[][]
  if (view === 'day') {
    rows = [['Date', 'Room', 'Child', 'Status', 'Arrival', 'Departure']]
    for (const e of report.daily)
      rows.push([
        from,
        e.roomName,
        e.name,
        e.present ? 'Present' : 'Absent',
        fmtTime(e.checkedInAt),
        fmtTime(e.checkedOutAt),
      ])
  } else {
    rows = [
      [
        'Period start',
        'Period end',
        'Room',
        'Child',
        'Present days',
        'Absent days',
        'Operating days',
        'Attendance %',
      ],
    ]
    for (const e of report.range)
      rows.push([
        from,
        to,
        e.roomName,
        e.name,
        e.present,
        e.absent,
        e.operating,
        e.rate == null ? '' : `${e.rate}%`,
      ])
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${attendanceReportFilename(from, to)}"`,
    },
  })
}
