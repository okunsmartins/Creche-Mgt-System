import type { Metadata } from 'next'
import { listPortalSignups } from '@/lib/onboarding/signups'
import { SignupRowActions } from '@/components/onboarding/SignupRowActions'

export const metadata: Metadata = { title: 'Sign-ups — Platform' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PlatformSignupsPage() {
  const signups = await listPortalSignups()

  if (signups.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
        No portal sign-up requests yet.
      </p>
    )
  }

  const verifiedCount = signups.filter((s) => s.verified).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {signups.length} request{signups.length === 1 ? '' : 's'} · {verifiedCount} confirmed
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface text-xs font-semibold uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Crèche</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {signups.map((s) => (
              <tr key={s.id} className="bg-surface">
                <td className="px-4 py-3 font-medium text-text-primary">{s.email}</td>
                <td className="px-4 py-3 text-text-secondary">{s.contactName ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{s.schoolName ?? '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDate(s.requestedAt)}</td>
                <td className="px-4 py-3">
                  {s.verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-text-muted ring-1 ring-border">
                      <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                      Awaiting
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SignupRowActions id={s.id} verified={s.verified} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
