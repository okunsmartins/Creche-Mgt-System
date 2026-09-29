import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, ArrowRight, BarChart3 } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses, selectTeacherClass } from '@/lib/teachers/classes'
import { ClassSwitcher } from '@/components/teacher/ClassSwitcher'

export const metadata: Metadata = { title: 'Attendance' }

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const user = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const { classId } = await searchParams

  const teacherClasses = await resolveTeacherClasses(adminClient, user.email)
  const classes = teacherClasses?.classes ?? []
  const assignedClass = selectTeacherClass(classes, classId)
  const classQuery = assignedClass ? `?classId=${assignedClass.id}` : ''

  const { data: sessions } = assignedClass
    ? await adminClient
        .from('attendance_sessions')
        .select('id, session_date, notes')
        .eq('class_id', assignedClass.id)
        .order('session_date', { ascending: false })
        .limit(50)
    : { data: [] }

  // Fetch record counts per session
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
          {assignedClass && <p className="mt-1 text-sm text-text-muted">{assignedClass.name}</p>}
        </div>
        {assignedClass && (
          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/attendance/summary${classQuery}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:text-primary"
            >
              <BarChart3 className="h-4 w-4" />
              Summary
            </Link>
            <Link
              href={`/teacher/attendance/new${classQuery}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
            >
              <Plus className="h-4 w-4" />
              Mark attendance
            </Link>
          </div>
        )}
      </div>

      {classes.length > 1 && assignedClass && (
        <ClassSwitcher
          classes={classes}
          selectedId={assignedClass.id}
          basePath="/teacher/attendance"
        />
      )}

      {!assignedClass && (
        <div className="rounded-2xl bg-amber-500/10 px-5 py-4 ring-1 ring-amber-500/20">
          <p className="text-sm text-amber-300">
            No class assigned. Contact the crèche administrator.
          </p>
        </div>
      )}

      {assignedClass && (sessions ?? []).length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-text-muted">No attendance sessions yet.</p>
          <Link
            href={`/teacher/attendance/new${classQuery}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Mark your first session <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {(sessions ?? []).length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Present
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-400">
                  Late
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-red-400">
                  Absent
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted sm:table-cell">
                  Notes
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s) => {
                const counts = summaryMap[s.id] ?? { present: 0, late: 0, absent: 0 }
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatDate(s.session_date)}
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
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {s.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/teacher/attendance/${s.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
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
