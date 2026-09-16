import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, Users, ArrowRight, Plus } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses, selectTeacherClass } from '@/lib/teachers/classes'
import { ClassSwitcher } from '@/components/teacher/ClassSwitcher'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'
import { DonutChart, type DonutDatum } from '@/components/charts/DonutChart'

export const metadata: Metadata = { title: 'Teacher Dashboard' }

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const user = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const { classId } = await searchParams

  const firstName = user.profile?.firstName ?? user.email.split('@')[0] ?? 'there'

  // Resolve ALL of the teacher's active classes, then the one to show (the
  // requested class if it's theirs, else the first).
  const teacherClasses = await resolveTeacherClasses(adminClient, user.email)
  const classes = teacherClasses?.classes ?? []
  const assignedClass = selectTeacherClass(classes, classId)

  // Student count in class
  const { count: studentCount } = assignedClass
    ? await adminClient
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', assignedClass.id)
        .eq('is_active', true)
    : { count: 0 }

  // Sessions this month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: sessionsThisMonth } = assignedClass
    ? await adminClient
        .from('attendance_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', assignedClass.id)
        .gte('session_date', monthStart.toISOString().slice(0, 10))
    : { count: 0 }

  // Recent sessions (last 5)
  const { data: recentSessions } = assignedClass
    ? await adminClient
        .from('attendance_sessions')
        .select('id, session_date, notes')
        .eq('class_id', assignedClass.id)
        .order('session_date', { ascending: false })
        .limit(5)
    : { data: [] }

  const todayStr = new Date().toISOString().slice(0, 10)
  const takenToday = (recentSessions ?? []).some((s) => s.session_date === todayStr)

  // Carry the selected class through to the attendance pages.
  const classQuery = assignedClass ? `?classId=${assignedClass.id}` : ''

  // Attendance analytics for the selected class — last 7 sessions.
  let attendanceBar: BarDatum[] = []
  let attendanceDonut: DonutDatum[] = []
  if (assignedClass) {
    const { data: recentForChart } = await adminClient
      .from('attendance_sessions')
      .select('id, session_date')
      .eq('class_id', assignedClass.id)
      .order('session_date', { ascending: false })
      .limit(7)
    const sessions = ((recentForChart as { id: string; session_date: string }[] | null) ?? [])
      .slice()
      .reverse()
    if (sessions.length > 0) {
      const { data: recordsData } = await adminClient
        .from('attendance_records')
        .select('session_id, status')
        .in(
          'session_id',
          sessions.map((s) => s.id),
        )
      const records = (recordsData as { session_id: string; status: string }[] | null) ?? []
      attendanceBar = sessions.map((s) => ({
        label: new Date(s.session_date).toLocaleDateString('en-IE', {
          day: 'numeric',
          month: 'short',
        }),
        value: records.filter((r) => r.session_id === s.id && r.status !== 'absent').length,
      }))
      const counts: Record<string, number> = { present: 0, late: 0, absent: 0 }
      for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1
      attendanceDonut = [
        { label: 'Present', value: counts.present ?? 0 },
        { label: 'Late', value: counts.late ?? 0 },
        { label: 'Absent', value: counts.absent ?? 0 },
      ].filter((d) => d.value > 0)
    }
  }

  const stats = [
    {
      label: 'Students in class',
      value: (studentCount ?? 0).toString(),
      href: `/teacher/attendance${classQuery}`,
      icon: Users,
      glow: 'card-glow-green',
      cta: 'View attendance',
    },
    {
      label: 'Sessions this month',
      value: (sessionsThisMonth ?? 0).toString(),
      href: `/teacher/attendance${classQuery}`,
      icon: ClipboardCheck,
      glow: takenToday ? 'card-glow-teal' : 'card-glow-amber',
      cta: takenToday ? 'View sessions' : 'Mark today',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Good {getTimeOfDay()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {assignedClass
            ? `${assignedClass.name} · ${user.schoolName ?? 'Teacher Portal'}`
            : `${user.schoolName ?? 'Teacher'} Portal`}
        </p>
      </div>

      {classes.length > 1 && assignedClass && (
        <ClassSwitcher
          classes={classes}
          selectedId={assignedClass.id}
          basePath="/teacher/dashboard"
        />
      )}

      {!assignedClass && (
        <div className="rounded-2xl bg-amber-500/10 px-5 py-4 ring-1 ring-amber-500/20">
          <p className="text-sm text-amber-300">
            No class is assigned to your teacher account yet. Contact the school administrator.
          </p>
        </div>
      )}

      {/* Stat cards — 2 column */}
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(({ label, value, href, icon: Icon, glow, cta }) => (
          <Link
            key={label}
            href={href}
            className={`${glow} group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
          >
            <div
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
              aria-hidden="true"
            />
            <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10 transition-all group-hover:bg-white group-hover:ring-primary/25">
              <Icon
                className="h-[18px] w-[18px] text-primary transition-colors"
                aria-hidden="true"
              />
            </div>
            <p className="text-2xl font-bold tracking-tight text-text-primary transition-transform group-hover:-translate-y-0.5">
              {value}
            </p>
            <p className="mt-0.5 text-sm font-medium text-text-secondary transition-transform group-hover:-translate-y-0.5">
              {label}
            </p>
            <div className="mt-4 overflow-hidden">
              <div className="flex translate-y-8 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20 backdrop-blur-sm">
                  {cta}
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Attendance analytics — recent-sessions bar + present/late/absent donut */}
      {assignedClass && attendanceBar.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BarChart
            title="Attendance — recent sessions"
            data={attendanceBar}
            formatValue={(v) => `${v} present`}
          />
          <DonutChart title="Attendance breakdown" data={attendanceDonut} />
        </div>
      )}

      {/* Quick action */}
      {assignedClass && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
            Attendance
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/teacher/attendance/new${classQuery}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
            >
              <Plus className="h-4 w-4" />
              {takenToday ? "Update today's attendance" : 'Mark attendance today'}
            </Link>
            <Link
              href={`/teacher/attendance${classQuery}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-primary/30 hover:bg-surface-raised hover:text-primary"
            >
              View all sessions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {(recentSessions ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
            Recent Sessions
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {(recentSessions ?? []).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatDate(s.session_date)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{s.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/teacher/attendance/${s.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
