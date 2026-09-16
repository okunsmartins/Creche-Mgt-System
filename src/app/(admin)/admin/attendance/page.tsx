import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Download, BarChart2, Lock } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Attendance' }

export default async function AdminAttendancePage() {
  const admin = await requireAdmin()
  const isPro = await schoolHasProAccess(admin.schoolId!)
  const adminClient = createSupabaseAdminClient()

  const { data: sessions } = await adminClient
    .from('attendance_sessions')
    .select(
      'id, session_date, notes, class_id, teacher_id, classes(name), teachers(first_name, last_name, display_name)',
    )
    .eq('school_id', admin.schoolId!)
    .order('session_date', { ascending: false })
    .limit(100)

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: allRecords } =
    sessionIds.length > 0
      ? await adminClient
          .from('attendance_records')
          .select('session_id, status')
          .in('session_id', sessionIds)
      : { data: [] }

  type RecordSummary = { present: number; late: number; absent: number }
  const summaryMap: Record<string, RecordSummary> = {}
  for (const r of allRecords ?? []) {
    if (!summaryMap[r.session_id]) summaryMap[r.session_id] = { present: 0, late: 0, absent: 0 }
    const entry = summaryMap[r.session_id]
    if (entry) entry[r.status as keyof RecordSummary]++
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance</h1>
          <p className="mt-1 text-sm text-text-muted">
            {(sessions ?? []).length} sessions recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/attendance/summary"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:text-primary"
          >
            <BarChart2 className="h-4 w-4" />
            Summary
          </Link>
          {isPro ? (
            <a
              href="/api/admin/reports/attendance"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:text-primary"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          ) : (
            <Link
              href="/pricing?locked=advanced_reports"
              title="CSV export is a Pro feature"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition-all hover:border-primary/30 hover:text-primary"
            >
              <Lock className="h-4 w-4" />
              Export CSV (Pro)
            </Link>
          )}
        </div>
      </div>

      {(sessions ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-text-muted">No attendance sessions recorded yet.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Class
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted sm:table-cell">
                  Teacher
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  P
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-400">
                  L
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-red-400">
                  A
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s) => {
                const counts = summaryMap[s.id] ?? { present: 0, late: 0, absent: 0 }
                const className = (s.classes as unknown as { name: string } | null)?.name ?? '—'
                const teacherRaw = s.teachers as unknown as {
                  first_name: string
                  last_name: string
                  display_name: string | null
                } | null
                const teacherName = teacherRaw
                  ? (teacherRaw.display_name ?? `${teacherRaw.first_name} ${teacherRaw.last_name}`)
                  : '—'
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatDate(s.session_date)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{className}</td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {teacherName}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-400">
                      {counts.present}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-amber-400">
                      {counts.late}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-red-400">
                      {counts.absent}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/attendance/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
