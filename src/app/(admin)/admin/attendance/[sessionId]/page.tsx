import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Session Detail' }

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()

  const { data: session } = await adminClient
    .from('attendance_sessions')
    .select(
      'id, session_date, notes, class_id, teacher_id, classes(name), teachers(first_name, last_name, display_name)',
    )
    .eq('id', sessionId)
    .eq('school_id', admin.schoolId!)
    .maybeSingle()

  if (!session) notFound()

  const { data: records } = await adminClient
    .from('attendance_records')
    .select('id, status, note, parent_reason, student_id, students(first_name, last_name)')
    .eq('session_id', sessionId)
    .order('student_id')

  const counts = { present: 0, late: 0, absent: 0 }
  for (const r of records ?? []) counts[r.status as keyof typeof counts]++

  const className = (session.classes as unknown as { name: string } | null)?.name ?? '—'
  const teacherRaw = session.teachers as unknown as {
    first_name: string
    last_name: string
    display_name: string | null
  } | null
  const teacherName = teacherRaw
    ? (teacherRaw.display_name ?? `${teacherRaw.first_name} ${teacherRaw.last_name}`)
    : '—'

  const STATUS_ICON = {
    present: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    late: <Clock className="h-4 w-4 text-amber-400" />,
    absent: <XCircle className="h-4 w-4 text-red-400" />,
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/attendance" className="text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {formatDate(session.session_date)}
          </h1>
          <p className="text-sm text-text-muted">
            {className} · {teacherName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
          <CheckCircle2 className="h-3.5 w-3.5" /> {counts.present} Present
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
          <Clock className="h-3.5 w-3.5" /> {counts.late} Late
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
          <XCircle className="h-3.5 w-3.5" /> {counts.absent} Absent
        </span>
      </div>

      {session.notes && <p className="text-sm text-text-muted">Notes: {session.notes}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted sm:table-cell">
                Note
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                Parent reason
              </th>
            </tr>
          </thead>
          <tbody>
            {(records ?? []).map((r) => {
              const student = r.students as unknown as {
                first_name: string
                last_name: string
              } | null
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {student ? `${student.first_name} ${student.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      {STATUS_ICON[r.status as keyof typeof STATUS_ICON]}
                      {r.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                    {r.note ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.parent_reason ? r.parent_reason : <span className="text-text-muted">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
