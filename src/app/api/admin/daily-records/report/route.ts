import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getDailyRecordsReport } from '@/lib/daily-records/report-queries'
import { DAILY_RECORD_TYPES, DAILY_RECORD_LABELS } from '@/lib/daily-records/records'
import { toCsv } from '@/lib/rota/payroll'
import {
  attendanceRange as periodRange,
  isAttendanceView as isPeriodView,
} from '@/lib/attendance/checkinReport'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Daily-records report CSV (day / week / month), anchored on `date`. Admin + school-scoped. */
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })

  const sp = request.nextUrl.searchParams
  const view = isPeriodView(sp.get('view') ?? '')
    ? (sp.get('view') as 'day' | 'week' | 'month')
    : 'day'
  const dateParam = sp.get('date')
  const anchor =
    dateParam && ISO.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10)
  const { from, to } = periodRange(view, anchor)
  const report = await getDailyRecordsReport(admin.schoolId, from, to)

  let rows: (string | number)[][]
  if (view === 'day') {
    rows = [['Date', 'Time', 'Child', 'Type', 'Note']]
    for (const e of report.entries)
      rows.push([e.date, e.time, e.childName, DAILY_RECORD_LABELS[e.type], e.note ?? ''])
  } else {
    rows = [['Child', ...DAILY_RECORD_TYPES.map((t) => DAILY_RECORD_LABELS[t]), 'Total']]
    for (const c of report.byChild)
      rows.push([c.name, ...DAILY_RECORD_TYPES.map((t) => c.counts[t]), c.total])
    rows.push(['All children', ...DAILY_RECORD_TYPES.map((t) => report.byType[t]), report.total])
  }

  const filename = from === to ? `daily-records-${from}.csv` : `daily-records-${from}-to-${to}.csv`
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
