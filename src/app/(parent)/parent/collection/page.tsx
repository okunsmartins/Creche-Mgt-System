import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { ParentCollectionForm } from '@/components/collection/ParentCollectionForm'
import {
  ENROLMENT_STATUS_LABELS,
  CHARGE_BASIS_UNIT,
  REGISTER_STATUS_LABELS,
  type EnrolmentStatus,
  type ChargeBasis,
  type RegisterStatus,
} from '@/lib/collection/collection'
import { formatCurrency, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'School Collection' }

const STATUS_VARIANT: Record<EnrolmentStatus, 'success' | 'warning' | 'error' | 'default'> = {
  approved: 'success',
  requested: 'warning',
  declined: 'error',
  ended: 'default',
}

const REGISTER_VARIANT: Record<RegisterStatus, 'success' | 'warning' | 'error' | 'default'> = {
  released: 'success',
  collected: 'warning',
  absent: 'error',
  scheduled: 'default',
}

export default async function ParentCollectionPage() {
  const parent = await requireVerifiedAuth()
  const db = createSupabaseAdminClient()

  const { data: linkData } = await db
    .from('parent_student_links')
    .select('student_id, students(first_name, last_name, school_id)')
    .eq('parent_id', parent.id)
    .eq('is_active', true)

  const links = (linkData ?? []) as unknown as {
    student_id: string
    students: { first_name: string | null; last_name: string | null; school_id: string } | null
  }[]
  const childIds = links.map((l) => l.student_id)
  const childOptions = links.map((l) => ({
    id: l.student_id,
    name: [l.students?.first_name, l.students?.last_name].filter(Boolean).join(' ') || 'My child',
  }))
  const schoolId = links.find((l) => l.students?.school_id)?.students?.school_id ?? null

  // Active runs offered by this crèche.
  const { data: runData } = schoolId
    ? await db
        .from('collection_runs')
        .select('id, name, origin_school_name, charge_basis, price_cents')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name')
    : { data: [] }
  const runs = (runData ?? []) as {
    id: string
    name: string
    origin_school_name: string
    charge_basis: string
    price_cents: number
  }[]

  // The parent's children's enrolments.
  let enrolments: {
    id: string
    status: string
    students: { first_name: string | null; last_name: string | null } | null
    collection_runs: { name: string } | null
  }[] = []
  if (childIds.length > 0) {
    const { data } = await db
      .from('collection_enrolments')
      .select('id, status, students(first_name, last_name), collection_runs(name)')
      .in('student_id', childIds)
      .order('created_at', { ascending: false })
    enrolments = (data ?? []) as unknown as typeof enrolments
  }

  // Collection history: the register entries for this parent's children (read-only).
  // Scoped by the parent's own child ids (from active links), so only their children show.
  let history: {
    id: string
    date: string
    status: string
    collected_at: string | null
    released_at: string | null
    students: { first_name: string | null; last_name: string | null } | null
    collection_runs: { name: string } | null
    authorised_collectors: { full_name: string } | null
  }[] = []
  if (childIds.length > 0) {
    const { data } = await db
      .from('collection_register')
      .select(
        'id, date, status, collected_at, released_at, students(first_name, last_name), collection_runs(name), authorised_collectors(full_name)',
      )
      .in('student_id', childIds)
      .order('date', { ascending: false })
      .order('released_at', { ascending: false, nullsFirst: false })
      .limit(100)
    history = (data ?? []) as unknown as typeof history
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">School collection</h1>
      <p className="mb-6 text-sm text-text-muted">
        Request your crèche to collect your child from their primary school. The crèche reviews and
        approves each request.
      </p>

      {childIds.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
          No children linked to your account yet. Link a child under{' '}
          <span className="font-medium">My Children</span> first.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Your requests</h2>
            {enrolments.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
                No collection requests yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface text-left text-text-muted">
                    <tr>
                      <th className="px-4 py-3">Child</th>
                      <th className="px-4 py-3">Run</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrolments.map((e) => {
                      const status = e.status as EnrolmentStatus
                      return (
                        <tr key={e.id}>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {[e.students?.first_name, e.students?.last_name]
                              .filter(Boolean)
                              .join(' ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {e.collection_runs?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                              {ENROLMENT_STATUS_LABELS[status] ?? e.status}
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

          <section className="mb-8">
            <h2 className="mb-1 text-lg font-semibold text-text-primary">Collection history</h2>
            <p className="mb-3 text-sm text-text-muted">
              A record of each day your child was collected from school and released to an
              authorised collector.
            </p>
            {history.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
                No collection history yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface text-left text-text-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Child</th>
                      <th className="px-4 py-3">Run</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Released to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((h) => {
                      const status = h.status as RegisterStatus
                      return (
                        <tr key={h.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                            {formatDate(h.date)}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {[h.students?.first_name, h.students?.last_name]
                              .filter(Boolean)
                              .join(' ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {h.collection_runs?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={REGISTER_VARIANT[status] ?? 'default'}>
                              {REGISTER_STATUS_LABELS[status] ?? h.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {h.status === 'released' && h.authorised_collectors?.full_name ? (
                              <>
                                {h.authorised_collectors.full_name}
                                {h.released_at && (
                                  <span className="block text-xs text-text-muted">
                                    {formatDate(h.released_at, true)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
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
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Request collection</h2>
            {runs.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
                Your crèche isn&apos;t offering any collection runs at the moment.
              </div>
            ) : (
              <ParentCollectionForm
                childOptions={childOptions}
                runOptions={runs.map((r) => ({
                  id: r.id,
                  label: `${r.name} — from ${r.origin_school_name} (${formatCurrency(r.price_cents)}/${
                    CHARGE_BASIS_UNIT[r.charge_basis as ChargeBasis] ?? r.charge_basis
                  })`,
                }))}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
