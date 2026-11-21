import type { Metadata } from 'next'
import { getAdminMfaRows } from '@/lib/platform/mfaAdmins'
import { ADMIN_MFA_GRACE_DAYS } from '@/lib/auth/mfa-policy'
import { ResetMfaButton } from '@/components/platform/ResetMfaButton'

export const metadata: Metadata = { title: 'Platform · Security' }
export const dynamic = 'force-dynamic'

// Owner-only (guarded by app/platform/layout.tsx).
export default async function PlatformSecurityPage() {
  const rows = await getAdminMfaRows()
  const setUp = rows.filter((r) => r.enrolled).length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Two-step sign-in (admins)</h2>
        <p className="mt-1 text-sm text-text-muted">
          Every crèche admin must use an authenticator app. New admins get {ADMIN_MFA_GRACE_DAYS}{' '}
          days to set it up. If someone loses their phone, reset it here and they set it up again at
          their next sign-in. {setUp} of {rows.length} set up.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No admins yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {['Admin', 'Email', 'Crèche', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.schools.join(', ')}</td>
                  <td className="px-4 py-3">
                    {r.enrolled ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                        Set up
                      </span>
                    ) : r.graceDaysLeft && r.graceDaysLeft > 0 ? (
                      <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                        Not yet · {r.graceDaysLeft} day{r.graceDaysLeft === 1 ? '' : 's'} left
                      </span>
                    ) : (
                      <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">
                        Required now
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.enrolled && <ResetMfaButton userId={r.userId} name={r.name} />}
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
