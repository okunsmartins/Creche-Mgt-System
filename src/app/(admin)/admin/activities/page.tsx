import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ActivityRow, ActivityClassEligibilityRow } from '@/types/database'

export const metadata: Metadata = { title: 'Activities' }

const PAGE_SIZE = 25

type ActivityListItem = Pick<
  ActivityRow,
  'id' | 'name' | 'amount_cents' | 'publication_status' | 'opens_at' | 'closes_at' | 'created_at'
> & {
  activity_class_eligibility: Pick<ActivityClassEligibilityRow, 'class_id'>[]
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
]

export default async function AdminActivitiesPage({ searchParams }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const params = await searchParams
  const status = params.status ?? 'all'
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createSupabaseAdminClient()

  let query = supabase
    .from('activities')
    .select(
      'id, name, amount_cents, publication_status, opens_at, closes_at, created_at, activity_class_eligibility(class_id)',
    )
    .eq('school_id', admin.schoolId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') {
    query = query.eq('publication_status', status)
  }

  const { data: rawActivities, error } = await query

  if (error) {
    return <p className="text-error">Failed to load activities. Please refresh.</p>
  }

  const activities = rawActivities as ActivityListItem[] | null
  const hasMore = (activities?.length ?? 0) === PAGE_SIZE
  const filterBase = new URLSearchParams(status !== 'all' ? { status } : {})

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Activities</h1>
        <Button asChild>
          <Link href="/admin/activities/new">New activity</Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/activities${value !== 'all' ? `?status=${value}` : ''}`}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === value
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:border-gray-300 hover:text-text-primary'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {(activities?.length ?? 0) === 0 ? (
        <div className="py-16 text-center">
          <p className="text-text-muted">
            {status === 'all' ? 'No activities yet.' : `No ${status} activities.`}
          </p>
          {status === 'all' && (
            <Button asChild className="mt-4">
              <Link href="/admin/activities/new">Create your first activity</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Name
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted sm:table-cell">
                  Amount
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted md:table-cell">
                  Classes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted lg:table-cell">
                  Closes
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(activities ?? []).map((activity) => (
                <tr key={activity.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{activity.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted sm:hidden">
                      {formatCurrency(activity.amount_cents)}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-right text-text-secondary sm:table-cell">
                    {formatCurrency(activity.amount_cents)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {activity.activity_class_eligibility.length}{' '}
                    {activity.activity_class_eligibility.length === 1 ? 'class' : 'classes'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={activity.publication_status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-text-muted lg:table-cell">
                    {activity.closes_at ? formatDate(activity.closes_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/activities/${activity.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/activities?${new URLSearchParams({ ...Object.fromEntries(filterBase), page: String(page - 1) })}`}
              className="text-primary hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text-muted">Page {page}</span>
          {hasMore ? (
            <Link
              href={`/admin/activities?${new URLSearchParams({ ...Object.fromEntries(filterBase), page: String(page + 1) })}`}
              className="text-primary hover:underline"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
