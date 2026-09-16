import type { Metadata } from 'next'
import { getSchoolsOverview, type SchoolOverviewRow } from '@/lib/platform/schools'
import { SchoolRowActions } from '@/components/platform/SchoolRowActions'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Schools — Platform' }

function euro(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

function statusText(row: SchoolOverviewRow): string {
  if (row.status === 'none') return 'No subscription'
  switch (row.status) {
    case 'trialing':
      return 'Trialing'
    case 'active':
      return 'Active'
    case 'past_due':
      return 'Past due'
    case 'cancelled':
      return 'Cancelled'
    case 'incomplete':
      return 'Incomplete'
    default:
      return row.status
  }
}

export default async function PlatformSchoolsPage() {
  const { schools } = await getSchoolsOverview({ includeInactive: true })

  if (schools.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
        No schools yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-surface text-xs font-semibold uppercase tracking-wider text-text-muted">
          <tr>
            <th className="px-4 py-3">School</th>
            <th className="px-4 py-3">Subdomain</th>
            <th className="px-4 py-3 text-right">Students</th>
            <th className="px-4 py-3 text-right">Revenue</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Subscription</th>
            <th className="px-4 py-3">SMS</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {schools.map((s) => (
            <tr key={s.id} className={s.isActive ? 'bg-surface' : 'bg-surface opacity-60'}>
              <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
              <td className="px-4 py-3 text-text-secondary">{s.subdomain ?? '—'}</td>
              <td className="px-4 py-3 text-right text-text-secondary">{s.studentsCount}</td>
              <td className="px-4 py-3 text-right text-text-secondary">
                {s.collectedCents > 0 ? euro(s.collectedCents) : '—'}
              </td>
              <td className="px-4 py-3 text-text-secondary">{formatDate(s.createdAt)}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    s.hasAccess
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary'
                      : 'inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-text-muted ring-1 ring-border'
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${s.hasAccess ? 'bg-primary' : 'bg-text-muted'}`}
                  />
                  {statusText(s)}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">{s.smsEnabled ? 'Yes' : '—'}</td>
              <td className="px-4 py-3">
                {s.isActive ? (
                  <span className="text-xs font-semibold text-primary">Active</span>
                ) : (
                  <span className="text-xs font-semibold text-error">Deactivated</span>
                )}
              </td>
              <td className="px-4 py-3">
                <SchoolRowActions schoolId={s.id} name={s.name} isActive={s.isActive} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
