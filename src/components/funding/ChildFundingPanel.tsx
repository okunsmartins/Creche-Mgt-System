import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import type { ChildFundingSummary } from '@/lib/funding/queries'

const SEV_VARIANT: Record<string, 'error' | 'warning' | 'default'> = {
  URGENT: 'error',
  ACTION: 'warning',
  INFO: 'default',
}

function fmt(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Read-only funding summary for the admin child profile. Non-sensitive only: PPSN is
 * shown as "on file" (never the value), CHICK is not surfaced, and AIM is excluded
 * (it lives behind its own restricted permission). Rendered only for tenants with the
 * Funding & Hive Centre enabled, to a `funding.view` admin.
 */
export function ChildFundingPanel({ summary }: { summary: ChildFundingSummary }) {
  const { registrations, latestWeekly, openActions, latestClaim } = summary
  const empty =
    registrations.length === 0 && !latestWeekly && openActions.length === 0 && !latestClaim

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Funding</h2>
        <Link href="/admin/funding" className="text-sm text-primary hover:underline">
          Funding &amp; Hive Centre →
        </Link>
      </div>

      {empty ? (
        <p className="text-sm text-text-muted">No funding records for this child yet.</p>
      ) : (
        <div className="space-y-4">
          {registrations.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Registrations
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {registrations.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">{r.scheme}</span>
                    <Badge variant={r.status === 'ACTIVE' ? 'success' : 'default'}>
                      {r.status}
                    </Badge>
                    {r.scheme === 'NCS' && r.ncsAwardExpiry && (
                      <span className="text-text-secondary">
                        award expires {fmt(r.ncsAwardExpiry)}
                      </span>
                    )}
                    {r.scheme === 'ECCE' && r.ecceSession && (
                      <span className="text-text-secondary">session {r.ecceSession}</span>
                    )}
                    {r.ppsnPresent && (
                      <span className="text-xs text-text-muted">· PPSN on file</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestWeekly && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Latest NCS week
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Week of {fmt(latestWeekly.weekStart)} —{' '}
                {latestWeekly.underAttended ? (
                  <span className="font-medium text-warning">
                    under-attended ({latestWeekly.consecutiveUnderWeeks} consecutive week
                    {latestWeekly.consecutiveUnderWeeks === 1 ? '' : 's'})
                  </span>
                ) : (
                  <span className="text-success">met claimed hours</span>
                )}
                {latestWeekly.thresholdEvent !== 'NONE' && (
                  <Badge variant="error" className="ml-2">
                    {latestWeekly.thresholdEvent}
                  </Badge>
                )}
              </p>
            </div>
          )}

          {latestClaim && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Latest NCS claim
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {latestClaim.status.replace(/_/g, ' ')}
                {latestClaim.copaymentCents != null && (
                  <> · co-payment {formatCurrency(latestClaim.copaymentCents)}/wk</>
                )}
              </p>
            </div>
          )}

          {openActions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Open funding actions
              </h3>
              <ul className="mt-1 space-y-2">
                {openActions.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <Badge variant={SEV_VARIANT[a.severity] ?? 'default'}>{a.severity}</Badge>
                    <span className="text-text-secondary">{a.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
