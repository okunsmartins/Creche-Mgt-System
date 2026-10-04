import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getFundingDashboard } from '@/lib/funding/queries'
import { latestCompletedWeekStart } from '@/lib/funding/week'
import { FundingDashboard } from '@/components/funding/FundingDashboard'

export const metadata: Metadata = { title: 'Funding & Hive Centre | Admin' }

// Actions/snapshots change on run; never cache.
export const dynamic = 'force-dynamic'

export default async function FundingCentrePage() {
  const user = await requireFundingAdmin()
  const data = await getFundingDashboard(user.schoolId!)
  const canManage = hasFundingPermission(user, 'funding.manage_ncs')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Funding &amp; Hive Centre</h1>
        <p className="mt-1 text-sm text-text-muted">
          Creche Wise watches your operational records and surfaces the NCS funding actions that
          actually need attention — with the values and evidence prepared. Hive remains the official
          portal; nothing is submitted automatically.
        </p>
      </div>
      <FundingDashboard data={data} weekStart={latestCompletedWeekStart()} canManage={canManage} />
    </div>
  )
}
