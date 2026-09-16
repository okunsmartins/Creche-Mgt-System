import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { LinkRequestActions } from '@/components/students/LinkRequestActions'
import { logger } from '@/lib/logging'
import type { ParentLinkRequestRow, ProfileRow, StudentRow, ClassRow } from '@/types/database'

export const metadata: Metadata = { title: 'Link Requests' }

type PendingRequest = Pick<ParentLinkRequestRow, 'id' | 'requested_at'> & {
  profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'email'> | null
  students:
    | (Pick<StudentRow, 'first_name' | 'last_name' | 'pupil_payment_code'> & {
        classes: Pick<ClassRow, 'name'> | null
      })
    | null
}

type HistoryRequest = Pick<
  ParentLinkRequestRow,
  'id' | 'status' | 'requested_at' | 'reviewed_at' | 'rejection_reason'
> & {
  profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'email'> | null
  students: Pick<StudentRow, 'first_name' | 'last_name'> | null
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminLinkRequestsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const { tab } = await searchParams
  const activeTab = tab === 'history' ? 'history' : 'pending'

  const supabase = createSupabaseAdminClient()

  if (activeTab === 'pending') {
    const { data: rawRequests, error } = await supabase
      .from('parent_link_requests')
      .select(
        'id, requested_at, profiles!parent_id(first_name, last_name, email), students(first_name, last_name, pupil_payment_code, classes(name))',
      )
      .eq('school_id', admin.schoolId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })

    const requests = rawRequests as PendingRequest[] | null

    if (error) {
      logger.error('link_requests_load_failed', { message: error.message, code: error.code })
      return <p className="text-error">Failed to load link requests. Please refresh.</p>
    }

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Parent Link Requests</h1>
          <p className="mt-1 text-sm text-text-muted">
            Approve or reject parent requests to link to a student.
          </p>
        </div>

        <Tabs active="pending" />

        {requests?.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-text-muted">No pending requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Parent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(requests ?? []).map((req) => (
                  <tr key={req.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {req.profiles?.first_name} {req.profiles?.last_name}
                      </p>
                      <p className="text-xs text-text-muted">{req.profiles?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {req.students?.last_name}, {req.students?.first_name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {req.students?.classes?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {req.students?.pupil_payment_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(req.requested_at).toLocaleDateString('en-IE')}
                    </td>
                    <td className="px-4 py-3">
                      <LinkRequestActions requestId={req.id} />
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

  // History tab
  const { data: rawHistory, error: historyError } = await supabase
    .from('parent_link_requests')
    .select(
      'id, status, requested_at, reviewed_at, rejection_reason, profiles!parent_id(first_name, last_name, email), students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })
    .limit(100)

  const history = rawHistory as HistoryRequest[] | null

  if (historyError) {
    logger.error('link_requests_history_load_failed', {
      message: historyError.message,
      code: historyError.code,
    })
    return <p className="text-error">Failed to load request history. Please refresh.</p>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Parent Link Requests</h1>
      </div>

      <Tabs active="history" />

      {history?.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">No processed requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Parent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Reviewed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(history ?? []).map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">
                      {req.profiles?.first_name} {req.profiles?.last_name}
                    </p>
                    <p className="text-xs text-text-muted">{req.profiles?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {req.students?.last_name}, {req.students?.first_name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={req.status === 'approved' ? 'success' : 'error'}>
                      {req.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('en-IE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {req.rejection_reason ?? '—'}
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

function Tabs({ active }: { active: 'pending' | 'history' }) {
  return (
    <div className="mb-5 flex gap-1 border-b border-border">
      {(['pending', 'history'] as const).map((tab) => (
        <a
          key={tab}
          href={tab === 'pending' ? '/admin/link-requests' : '/admin/link-requests?tab=history'}
          className={[
            'px-4 py-2 text-sm font-medium capitalize',
            active === tab
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text-primary',
          ].join(' ')}
        >
          {tab}
        </a>
      ))}
    </div>
  )
}
