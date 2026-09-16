import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { TimeOffStatusBadge } from '@/components/timeoff/TimeOffStatusBadge'
import { TimeOffReviewButtons } from '@/components/timeoff/TimeOffReviewButtons'
import type { TimeOffRequestRow } from '@/types/database'

export const metadata: Metadata = { title: 'Time Off | Admin' }

type AdminRequestRow = Pick<
  TimeOffRequestRow,
  | 'id'
  | 'start_date'
  | 'end_date'
  | 'reason'
  | 'status'
  | 'reviewed_at'
  | 'review_note'
  | 'created_at'
> & {
  teachers: { first_name: string; last_name: string; display_name: string | null } | null
  profiles: { first_name: string | null; last_name: string | null } | null
}

function teacherName(row: AdminRequestRow): string {
  const t = row.teachers
  if (!t) return 'Unknown teacher'
  return t.display_name ?? `${t.first_name} ${t.last_name}`
}

export default async function AdminTimeOffPage() {
  const admin = await requireAdmin()
  const adminClient = createSupabaseAdminClient()

  const { data } = await adminClient
    .from('time_off_requests')
    .select(
      'id, start_date, end_date, reason, status, reviewed_at, review_note, created_at, teachers(first_name, last_name, display_name), profiles!reviewed_by(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId!)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (data as AdminRequestRow[] | null) ?? []
  // Surface pending requests (the ones needing action) first.
  const requests = [...rows].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })
  const pendingCount = rows.filter((r) => r.status === 'pending').length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Time-off requests</h1>
        <p className="mt-1 text-sm text-text-muted">
          Review and approve staff time-off.
          {pendingCount > 0 ? ` ${pendingCount} awaiting your review.` : ''}
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
          No time-off requests yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{teacherName(r)}</p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ''}
                  </p>
                  {r.reason && <p className="mt-1 text-xs text-text-muted">{r.reason}</p>}
                  {r.status !== 'pending' && r.reviewed_at && (
                    <p className="mt-1 text-xs text-text-muted">
                      {r.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                      {formatDate(r.reviewed_at)}
                      {r.profiles
                        ? ` by ${[r.profiles.first_name, r.profiles.last_name].filter(Boolean).join(' ')}`
                        : ''}
                    </p>
                  )}
                  {r.status !== 'pending' && r.review_note && (
                    <p className="mt-1 text-xs text-text-muted">Note: {r.review_note}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {r.status === 'pending' ? (
                    <TimeOffReviewButtons requestId={r.id} />
                  ) : (
                    <TimeOffStatusBadge status={r.status} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
