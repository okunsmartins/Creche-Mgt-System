import type { Metadata } from 'next'
import { Download } from 'lucide-react'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getNcsWeeklyReturn } from '@/lib/funding/queries'
import { latestCompletedWeekStart, reportingWeekStart, weekEnd } from '@/lib/funding/week'
import { PrintButton } from '@/components/ui/PrintButton'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { FundingBackLink } from '@/components/funding/FundingBackLink'

export const metadata: Metadata = { title: 'NCS Weekly Return | Admin' }
export const dynamic = 'force-dynamic'

const EVENT_LABEL: Record<string, string> = {
  ABSENCE_4: '4-week absence',
  UNDER_8: '8-week under-attendance',
  UNDER_12: '12-week continued under-attendance',
}
const EVENT_VARIANT: Record<string, 'error' | 'warning' | 'default'> = {
  ABSENCE_4: 'warning',
  UNDER_8: 'warning',
  UNDER_12: 'error',
}
const hrs = (minutes: number) => `${(minutes / 60).toFixed(1)}h`

export default async function NcsWeeklyReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireFundingAdmin()
  const { week } = await searchParams
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? '')
    ? reportingWeekStart(week!)
    : latestCompletedWeekStart()
  const data = await getNcsWeeklyReturn(user.schoolId!, weekStart)
  const canExport = hasFundingPermission(user, 'funding.export')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FundingBackLink />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">NCS weekly return</h1>
          <p className="mt-1 text-sm text-text-muted">
            The exceptions to review and report for one reporting week. Hive remains the official
            portal — nothing is submitted automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Week</span>
              <input type="date" name="week" defaultValue={weekStart} className="input-base" />
            </label>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
            >
              Go
            </button>
          </form>
          {canExport && (
            <a
              href={`/api/admin/funding/ncs-weekly?week=${weekStart}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </a>
          )}
          <PrintButton label="Print pack" />
        </div>
      </div>

      {/* Print/screen header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Reporting week: {formatDate(weekStart)} – {formatDate(weekEnd(weekStart))}
        </h2>
        <p className="text-sm text-text-muted">
          {data.total} active NCS {data.total === 1 ? 'child' : 'children'}: {data.noActionCount}{' '}
          clear, <span className="font-medium text-text-primary">{data.reviewRequired.length}</span>{' '}
          to review.
        </p>
      </div>

      {data.total === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No compliance has been built for this week yet. Run it from the{' '}
          <a href="/admin/funding" className="text-primary hover:underline">
            funding dashboard
          </a>
          .
        </div>
      ) : data.reviewRequired.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          All {data.total} NCS children attended as claimed this week — nothing to report.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-text-muted">
                <th className="px-4 py-2">Child</th>
                <th className="px-4 py-2">Issue</th>
                <th className="px-4 py-2">Claimed</th>
                <th className="px-4 py-2">This week</th>
                <th className="px-4 py-2">Consecutive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.reviewRequired.map((r) => (
                <tr key={r.studentId} className="align-top">
                  <td className="px-4 py-3 font-medium text-text-primary">{r.childName}</td>
                  <td className="px-4 py-3">
                    {r.thresholdEvent !== 'NONE' ? (
                      <Badge variant={EVENT_VARIANT[r.thresholdEvent] ?? 'warning'}>
                        {EVENT_LABEL[r.thresholdEvent] ?? r.thresholdEvent}
                      </Badge>
                    ) : (
                      <Badge variant="default">Approaching 8-week</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{hrs(r.claimedMinutes)}</td>
                  <td className="px-4 py-3 text-text-secondary">{hrs(r.actualMinutes)}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.fullWeekAbsent || r.consecutiveAbsenceWeeks > 0
                      ? `${r.consecutiveAbsenceWeeks} wk absent`
                      : `${r.consecutiveUnderWeeks} wk under`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.calculationVersion && (
        <p className="text-xs text-text-muted">
          Prepared by Creche Wise from recorded attendance. Calculation rules version{' '}
          <span className="font-medium">{data.calculationVersion}</span>. Verify and submit on the
          Early Years Hive.
        </p>
      )}
    </div>
  )
}
