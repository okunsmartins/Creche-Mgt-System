import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { ProgrammeRow, ProgrammeClassEligibilityRow } from '@/types/database'

export const metadata: Metadata = { title: 'Programmes' }

const PAGE_SIZE = 25

type ProgrammeListItem = Pick<
  ProgrammeRow,
  | 'id'
  | 'name'
  | 'price_cents'
  | 'pricing_model'
  | 'publication_status'
  | 'term_start'
  | 'term_end'
  | 'created_at'
> & {
  programme_class_eligibility: Pick<ProgrammeClassEligibilityRow, 'class_id'>[]
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

const PRICING_LABEL: Record<string, string> = {
  per_term: 'per term',
  per_month: 'per month',
  per_session: 'per session',
}

export default async function AdminProgrammesPage({ searchParams }: PageProps) {
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
    .from('programmes')
    .select(
      'id, name, price_cents, pricing_model, publication_status, term_start, term_end, created_at, programme_class_eligibility(class_id)',
    )
    .eq('school_id', admin.schoolId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') {
    query = query.eq('publication_status', status)
  }

  const { data: rawProgrammes, error } = await query

  if (error) {
    return <p className="text-error">Failed to load programmes. Please refresh.</p>
  }

  const programmes = rawProgrammes as ProgrammeListItem[] | null
  const hasMore = (programmes?.length ?? 0) === PAGE_SIZE
  const filterBase = new URLSearchParams(status !== 'all' ? { status } : {})

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Programmes</h1>
        <Button asChild>
          <Link href="/admin/programmes/new">New programme</Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/programmes${value !== 'all' ? `?status=${value}` : ''}`}
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

      {(programmes?.length ?? 0) === 0 ? (
        <div className="py-16 text-center">
          <p className="text-text-muted">
            {status === 'all' ? 'No programmes yet.' : `No ${status} programmes.`}
          </p>
          {status === 'all' && (
            <Button asChild className="mt-4">
              <Link href="/admin/programmes/new">Create your first programme</Link>
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
                  Price
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted md:table-cell">
                  Classes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted lg:table-cell">
                  Term start
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(programmes ?? []).map((programme) => (
                <tr key={programme.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{programme.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted sm:hidden">
                      {formatCurrency(programme.price_cents)}{' '}
                      {PRICING_LABEL[programme.pricing_model]}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    <span className="text-text-secondary">
                      {formatCurrency(programme.price_cents)}
                    </span>
                    <span className="ml-1 text-xs text-text-muted">
                      {PRICING_LABEL[programme.pricing_model]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {programme.programme_class_eligibility.length}{' '}
                    {programme.programme_class_eligibility.length === 1 ? 'class' : 'classes'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={programme.publication_status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-text-muted lg:table-cell">
                    {programme.term_start
                      ? new Date(programme.term_start).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/programmes/${programme.id}`}
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
              href={`/admin/programmes?${new URLSearchParams({ ...Object.fromEntries(filterBase), page: String(page - 1) })}`}
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
              href={`/admin/programmes?${new URLSearchParams({ ...Object.fromEntries(filterBase), page: String(page + 1) })}`}
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
