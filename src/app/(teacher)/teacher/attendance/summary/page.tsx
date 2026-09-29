import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  resolveDateRange,
  resolveGranularity,
  getClassAttendanceSummary,
  getClassAttendanceTrend,
} from '@/lib/attendance/summary'
import { AttendanceSummaryTable } from '@/components/attendance/AttendanceSummaryTable'
import { AttendanceRangeFilter } from '@/components/attendance/AttendanceRangeFilter'
import { AttendancePeriodRollup } from '@/components/attendance/AttendancePeriodRollup'
import { resolveTeacherClasses, selectTeacherClass } from '@/lib/teachers/classes'
import { ClassSwitcher } from '@/components/teacher/ClassSwitcher'
import { PrintButton } from '@/components/ui/PrintButton'

export const metadata: Metadata = { title: 'Attendance Summary' }

const BASE_PATH = '/teacher/attendance/summary'

export default async function TeacherAttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; g?: string; classId?: string }>
}) {
  const user = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const { from, to, g, classId } = await searchParams
  const range = resolveDateRange(from, to)
  const granularity = resolveGranularity(g)

  const teacherClasses = await resolveTeacherClasses(adminClient, user.email)
  const classes = teacherClasses?.classes ?? []
  const assignedClass = selectTeacherClass(classes, classId)

  if (!assignedClass) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">Attendance Summary</h1>
        <div className="rounded-2xl bg-amber-500/10 px-5 py-4 ring-1 ring-amber-500/20">
          <p className="text-sm text-amber-300">
            No class assigned to your account. Contact the crèche administrator.
          </p>
        </div>
      </div>
    )
  }

  const [{ students, totalSessions }, periods] = await Promise.all([
    getClassAttendanceSummary(adminClient, assignedClass.id, range.from, range.to),
    getClassAttendanceTrend(adminClient, assignedClass.id, range.from, range.to, granularity),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Attendance Summary</h1>
          <p className="mt-1 text-sm text-text-muted">
            {assignedClass.name} · {formatRange(range.from, range.to)}
          </p>
        </div>
        <PrintButton label="Print summary" />
      </div>

      {classes.length > 1 && (
        <ClassSwitcher
          classes={classes}
          selectedId={assignedClass.id}
          basePath={BASE_PATH}
          params={{ from: range.from, to: range.to, g: granularity }}
        />
      )}

      <AttendanceRangeFilter
        basePath={BASE_PATH}
        from={range.from}
        to={range.to}
        extraParams={{ g: granularity, classId: assignedClass.id }}
      />

      <AttendanceSummaryTable students={students} totalSessions={totalSessions} />

      <AttendancePeriodRollup
        periods={periods}
        granularity={granularity}
        basePath={BASE_PATH}
        params={{ from: range.from, to: range.to, classId: assignedClass.id }}
      />
    </div>
  )
}

function formatRange(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const f = new Date(from + 'T00:00:00').toLocaleDateString('en-IE', opts)
  const t = new Date(to + 'T00:00:00').toLocaleDateString('en-IE', opts)
  return `${f} – ${t}`
}
