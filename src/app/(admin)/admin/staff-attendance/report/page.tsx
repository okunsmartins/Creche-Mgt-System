import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { getStaffAttendanceReport } from '@/lib/staff-attendance/queries'
import { formatHours } from '@/lib/rota/rota'
import {
  attendanceRange as periodRange,
  shiftAnchor as shiftPeriod,
  isAttendanceView as isPeriodView,
  ATTENDANCE_VIEWS as PERIOD_VIEWS,
  type AttendanceView as PeriodView,
} from '@/lib/attendance/checkinReport'

export const metadata: Metadata = { title: 'Staff attendance report | Admin' }
export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const VIEW_LABELS: Record<PeriodView, string> = { day: 'Day', week: 'Week', month: 'Month' }

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Dublin',
  })
}

export default async function StaffAttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const sp = await searchParams
  const view: PeriodView = isPeriodView(sp.view ?? '') ? (sp.view as PeriodView) : 'week'
  const anchor = sp.date && ISO.test(sp.date) ? sp.date : new Date().toISOString().slice(0, 10)
  const { from, to } = periodRange(view, anchor)
  const report = await getStaffAttendanceReport(admin.schoolId, from, to)

  const href = (v: PeriodView, d: string) => `/admin/staff-attendance/report?view=${v}&date=${d}`
  const periodLabel = view === 'day' ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
  const csvHref = `/api/admin/staff/attendance-report?view=${view}&date=${anchor}`
  const totalMinutes = report.lines.reduce((n, l) => n + l.minutes, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/staff-attendance"
            className="mb-1 inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Staff clock-in
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Staff attendance report</h1>
          <p className="mt-1 text-sm text-text-muted">
            Hours worked per staff member from clock-in/out, by day, week or month.
          </p>
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {PERIOD_VIEWS.map((v) => (
            <Link
              key={v}
              href={href(v, anchor)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                v === view ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary'
              }`}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={href(view, shiftPeriod(view, anchor, -1))}
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:border-primary hover:text-primary"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[14rem] text-center text-sm font-medium text-text-primary">
            {periodLabel}
          </span>
          <Link
            href={href(view, shiftPeriod(view, anchor, 1))}
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:border-primary hover:text-primary"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {view === 'day' ? (
        report.daily.length === 0 ? (
          <Empty>No staff clocked in on this day.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">In</th>
                  <th className="px-3 py-2">Out</th>
                  <th className="px-3 py-2 text-right">Worked</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((e, i) => (
                  <tr key={`${e.teacherName}-${i}`} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium text-text-primary">{e.teacherName}</td>
                    <td className="px-3 py-2 text-text-secondary">{fmtTime(e.clockInAt)}</td>
                    <td className="px-3 py-2 text-text-secondary">{fmtTime(e.clockOutAt)}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">
                      {formatHours(e.minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : report.lines.length === 0 ? (
        <Empty>No staff clocked in during this period.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2 text-right">Hours worked</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => (
                <tr key={l.teacherId} className="border-b border-border/50">
                  <td className="px-3 py-2 font-medium text-text-primary">{l.name}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{l.days}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {formatHours(l.minutes)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="px-3 py-2 text-text-primary">Total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-text-primary">
                  {formatHours(totalMinutes)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
      {children}
    </div>
  )
}
