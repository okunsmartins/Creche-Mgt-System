import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { ChildSearchForm } from '@/components/students/ChildSearchForm'
import type {
  ParentStudentLinkRow,
  ParentLinkRequestRow,
  StudentRow,
  ClassRow,
} from '@/types/database'

export const metadata: Metadata = { title: 'My Children' }

type LinkedChild = Pick<ParentStudentLinkRow, 'id'> & {
  students:
    | (Pick<StudentRow, 'first_name' | 'last_name' | 'pupil_payment_code'> & {
        classes: Pick<ClassRow, 'name'> | null
      })
    | null
}

type PendingRequest = Pick<ParentLinkRequestRow, 'id' | 'requested_at' | 'status'> & {
  students: Pick<StudentRow, 'first_name' | 'last_name'> | null
}

export default async function ParentChildrenPage() {
  const parent = await requireVerifiedAuth()

  // Use admin client: auth.uid() evaluates to NULL in Server Component
  // contexts even after getUser() succeeds, so RLS policies gated on
  // auth.uid() return 0 rows. Scope manually to parent.id (already JWT-verified).
  const adminClient = createSupabaseAdminClient()
  const [linksResult, requestsResult] = await Promise.all([
    adminClient
      .from('parent_student_links')
      .select('id, students(first_name, last_name, pupil_payment_code, classes(name))')
      .eq('parent_id', parent.id)
      .eq('is_active', true)
      .order('created_at'),
    adminClient
      .from('parent_link_requests')
      .select('id, requested_at, status, students(first_name, last_name)')
      .eq('parent_id', parent.id)
      .in('status', ['pending', 'rejected'])
      .order('requested_at', { ascending: false })
      .limit(20),
  ])

  const links = linksResult.data as LinkedChild[] | null
  const requests = requestsResult.data as PendingRequest[] | null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">My Children</h1>

      {/* Linked children */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Linked children</h2>
        {!links?.length ? (
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="text-text-muted">
              No children linked yet. Use the form below to request a link.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Pupil code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(links ?? []).map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {link.students?.first_name} {link.students?.last_name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {link.students?.classes?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {link.students?.pupil_payment_code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending / rejected requests */}
      {(requests?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Link requests</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(requests ?? []).map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {req.students?.first_name} {req.students?.last_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(req.requested_at).toLocaleDateString('en-IE')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={req.status === 'pending' ? 'warning' : 'error'}>
                        {req.status === 'pending' ? 'Awaiting approval' : 'Rejected'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Find and link a child */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Link a child</h2>
        <ChildSearchForm />
      </section>
    </div>
  )
}
