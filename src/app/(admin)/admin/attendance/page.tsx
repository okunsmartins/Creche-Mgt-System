import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { Badge } from '@/components/ui/Badge'
import {
  getAttendanceReport,
  type DailyEntry,
  type RangeEntry,
} from '@/lib/attendance/checkin-queries'
import {
  attendanceRange,
  shiftAnchor,
  isAttendanceView,
  ATTENDANCE_VIEWS,
  type AttendanceView,
} from '@/lib/attendance/checkinReport'

export const metadata: Metadata = { title: 'Attendance' }
export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const VIEW_LABELS: Record<AttendanceView, string> = { day: 'Day', week: 'Week', month: 'Month' }

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
function fmtTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Dublin',
  })
}

/** Group already-room-sorted entries into [roomName, entries[]] pairs. */
function byRoom<T extends { roomName: string }>(entries: T[]): [string, T[]][] {
  const out: [string, T[]][] = []
  for (const e of entries) {
    const last = out[out.length - 1]
    if (last && last[0] === e.roomName) last[1].push(e)
    else out.push([e.roomName, [e]])
  }
  return out
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const sp = await searchParams
  const view: AttendanceView = isAttendanceView(sp.view ?? '')
    ? (sp.view as AttendanceView)
    : 'week'
  const anchor = sp.date && ISO.test(sp.date) ? sp.date : new Date().toISOString().slice(0, 10)
  const { from, to } = attendanceRange(view, anchor)

  const [isPro, report] = await Promise.all([
    schoolHasProAccess(admin.schoolId),
    getAttendanceReport(admin.schoolId, from, to),
  ])

  const href = (v: AttendanceView, d: string) => `/admin/attendance?view=${v}&date=${d}`
  const periodLabel = view === 'day' ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
  const csvHref = `/api/admin/attendance/report?view=${view}&date=${anchor}`

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance</h1>
          <p className="mt-1 text-sm text-text-muted">
            Based on the daily check-in board — present = checked in, absent = no check-in on a day
            the crèche was open.
          </p>
        </div>
        {isPro ? (
          <a
            href={csvHref}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        ) : (
          <Link
            href="/pricing?locked=advanced_reports"
            title="CSV export is a Pro feature"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:border-primary hover:text-primary"
          >
            <Lock className="h-4 w-4" /> Export CSV (Pro)
          </Link>
        )}
      </div>

      {/* Period controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {ATTENDANCE_VIEWS.map((v) => (
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
            href={href(view, shiftAnchor(view, anchor, -1))}
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:border-primary hover:text-primary"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[14rem] text-center text-sm font-medium text-text-primary">
            {periodLabel}
          </span>
          <Link
            href={href(view, shiftAnchor(view, anchor, 1))}
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:border-primary hover:text-primary"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {report.childCount === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No children enrolled yet.
        </div>
      ) : view === 'day' ? (
        <DayReport daily={report.daily} />
      ) : (
        <RangeReport range={report.range} operating={report.operating} />
      )}
    </div>
  )

  function DayReport({ daily }: { daily: DailyEntry[] }) {
    const presentCount = daily.filter((d) => d.present).length
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text-primary">{presentCount}</span> present ·{' '}
          {daily.length - presentCount} absent of {daily.length} enrolled
        </p>
        {byRoom(daily).map(([room, kids]) => (
          <div key={room} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-text-primary">{room}</h2>
            <ul className="mt-2 divide-y divide-border/60">
              {kids.map((c) => {
                const inT = fmtTime(c.checkedInAt)
                const outT = fmtTime(c.checkedOutAt)
                return (
                  <li
                    key={c.studentId}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant={c.present ? 'success' : 'error'}>
                        {c.present ? 'Present' : 'Absent'}
                      </Badge>
                      {c.name}
                    </span>
                    {c.present && (inT || outT) && (
                      <span className="text-xs text-text-muted">
                        {inT && <>In {inT}</>}
                        {outT && <> · Out {outT}</>}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  function RangeReport({ range, operating }: { range: RangeEntry[]; operating: number }) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text-primary">{operating}</span> operating day
          {operating === 1 ? '' : 's'} in this period (days a child was checked in). Attendance % =
          present ÷ operating days.
        </p>
        {operating === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
            No check-ins recorded in this period.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="px-3 py-2">Child</th>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2 text-right">Present</th>
                  <th className="px-3 py-2 text-right">Absent</th>
                  <th className="px-3 py-2 text-right">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {range.map((e) => (
                  <tr key={e.studentId} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium text-text-primary">{e.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{e.roomName}</td>
                    <td className="px-3 py-2 text-right text-success">{e.present}</td>
                    <td className="px-3 py-2 text-right text-text-secondary">{e.absent}</td>
                    <td className="px-3 py-2 text-right font-medium text-text-primary">
                      {e.rate == null ? '—' : `${e.rate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
}
