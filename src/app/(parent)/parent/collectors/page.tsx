import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { ParentCollectorsForm } from '@/components/collectors/ParentCollectorsForm'
import {
  COLLECTOR_RELATIONSHIP_LABELS,
  COLLECTOR_STATUS_LABELS,
  type CollectorStatus,
} from '@/lib/collectors/collectors'

export const metadata: Metadata = { title: 'Who Can Collect' }

interface RawCollector {
  id: string
  student_id: string
  full_name: string
  relationship: string
  phone: string | null
  status: string
  can_collect_unaccompanied: boolean
  students: { first_name: string | null; last_name: string | null } | null
}

const STATUS_VARIANT: Record<CollectorStatus, 'success' | 'warning' | 'error' | 'default'> = {
  approved: 'success',
  pending: 'warning',
  declined: 'error',
  revoked: 'default',
}

export default async function ParentCollectorsPage() {
  const parent = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  // The parent's actively-linked children (manual scope — auth.uid() is NULL in RSC).
  const { data: linkData } = await db
    .from('parent_student_links')
    .select('student_id, students(first_name, last_name)')
    .eq('parent_id', parent.id)
    .eq('is_active', true)

  const links = (linkData ?? []) as unknown as {
    student_id: string
    students: { first_name: string | null; last_name: string | null } | null
  }[]
  const childIds = links.map((l) => l.student_id)
  const childOptions = links.map((l) => ({
    id: l.student_id,
    name: [l.students?.first_name, l.students?.last_name].filter(Boolean).join(' ') || 'My child',
  }))

  let collectors: RawCollector[] = []
  if (childIds.length > 0) {
    const { data } = await db
      .from('authorised_collectors')
      .select(
        'id, student_id, full_name, relationship, phone, status, can_collect_unaccompanied, students(first_name, last_name)',
      )
      .in('student_id', childIds)
      .order('created_at', { ascending: false })
    collectors = (data ?? []) as unknown as RawCollector[]
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Who can collect my child</h1>
      <p className="mb-6 text-sm text-text-muted">
        Add the people allowed to collect your child. The crèche reviews and approves each one
        before it takes effect.
      </p>

      {childIds.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
          No children linked to your account yet. Link a child under{' '}
          <span className="font-medium">My Children</span> first.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Current collectors</h2>
            {collectors.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
                No collectors added yet. Use the form below.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface">
                    <tr className="text-left text-text-muted">
                      <th className="px-4 py-3">Child</th>
                      <th className="px-4 py-3">Collector</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {collectors.map((c) => {
                      const status = c.status as CollectorStatus
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {[c.students?.first_name, c.students?.last_name]
                              .filter(Boolean)
                              .join(' ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {c.full_name}
                            <span className="block text-xs text-text-muted">
                              {COLLECTOR_RELATIONSHIP_LABELS[
                                c.relationship as keyof typeof COLLECTOR_RELATIONSHIP_LABELS
                              ] ?? c.relationship}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                              {COLLECTOR_STATUS_LABELS[status] ?? c.status}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Add a collector</h2>
            <ParentCollectorsForm childOptions={childOptions} />
          </section>
        </>
      )}
    </div>
  )
}
