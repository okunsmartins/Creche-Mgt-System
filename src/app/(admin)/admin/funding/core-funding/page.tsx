import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getCoreFundingView } from '@/lib/funding/queries'
import { CoreFundingPanel } from '@/components/funding/CoreFundingPanel'
import { FundingBackLink } from '@/components/funding/FundingBackLink'

export const metadata: Metadata = { title: 'Core Funding | Admin' }
export const dynamic = 'force-dynamic'

const PROGRAMME_YEAR = '2026/2027'

export default async function CoreFundingPage() {
  const user = await requireFundingAdmin()
  const view = await getCoreFundingView(user.schoolId!, PROGRAMME_YEAR)
  const canManage = hasFundingPermission(user, 'funding.manage_core')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FundingBackLink />
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Core Funding {PROGRAMME_YEAR}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Core Funding is based on the service profile you confirm on Hive. Creche Wise keeps the
          last profile you verified and watches your live staff and room data for changes, so you
          can catch drift before the next Review &amp; Confirm window.
        </p>
      </div>
      <CoreFundingPanel view={view} canManage={canManage} />
    </div>
  )
}
