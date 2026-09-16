import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { TimeOffRequestForm } from '@/components/timeoff/TimeOffRequestForm'
import { TimeOffStatusBadge } from '@/components/timeoff/TimeOffStatusBadge'
import type { TimeOffRequestRow } from '@/types/database'

export const metadata: Metadata = { title: 'Time Off | Teacher' }

type RequestRow = Pick<
  TimeOffRequestRow,
  'id' | 'start_date' | 'end_date' | 'reason' | 'status' | 'review_note' | 'created_at'
>

export default async function TeacherTimeOffPage() {
  const teacher = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const schoolId = teacher.schoolId!

  const { data: teacherRow } = await adminClient
    .from('teachers')
    .select('id')
    .eq('email', teacher.email)
    .eq('is_active', true)
    .maybeSingle()
  const teacherId = (teacherRow as { id: string } | null)?.id

  const { data } = teacherId
    ? await adminClient
        .from('time_off_requests')
        .select('id, start_date, end_date, reason, status, review_note, created_at')
        .eq('school_id', schoolId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }
  const requests = (data as RequestRow[] | null) ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Time off</h1>
        <p className="mt-1 text-sm text-text-muted">
          Request time off and track whether your administrator has approved it.
        </p>
      </div>

      {teacherId ? (
        <TimeOffRequestForm />
      ) : (
        <div className="card p-6 text-sm text-text-muted">
          No active teacher record is linked to your account. Contact your administrator.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            You have no time-off requests yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ''}
                  </p>
                  <TimeOffStatusBadge status={r.status} />
                </div>
                {r.reason && <p className="mt-1 text-xs text-text-muted">{r.reason}</p>}
                {r.status === 'rejected' && r.review_note && (
                  <p className="mt-1 text-xs text-error">Note: {r.review_note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
