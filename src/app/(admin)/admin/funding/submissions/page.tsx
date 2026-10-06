import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getSubmissionSnapshots } from '@/lib/funding/queries'
import { latestCompletedWeekStart } from '@/lib/funding/week'
import { SubmissionsPanel } from '@/components/funding/SubmissionsPanel'

export const metadata: Metadata = { title: 'Submissions & evidence | Admin' }
export const dynamic = 'force-dynamic'

export default async function SubmissionsPage() {
  const user = await requireFundingAdmin()
  const snapshots = await getSubmissionSnapshots(user.schoolId!)
  const canPrepare = hasFundingPermission(user, 'funding.export')
  const canSubmit = hasFundingPermission(user, 'funding.mark_submitted')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Submissions &amp; evidence</h1>
        <p className="mt-1 text-sm text-text-muted">
          Immutable snapshots of what was prepared for Hive, with the rules version and who prepared
          and submitted it. Freeze a return before you submit it on Hive, then record the external
          reference here as your evidence trail.
        </p>
      </div>
      <SubmissionsPanel
        snapshots={snapshots}
        latestWeek={latestCompletedWeekStart()}
        canPrepare={canPrepare}
        canSubmit={canSubmit}
      />
    </div>
  )
}
