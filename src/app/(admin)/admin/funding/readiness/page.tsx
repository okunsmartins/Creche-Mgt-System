import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getReadinessItems } from '@/lib/funding/queries'
import { ReadinessPanel } from '@/components/funding/ReadinessPanel'
import { FundingBackLink } from '@/components/funding/FundingBackLink'

export const metadata: Metadata = { title: 'Programme Readiness | Admin' }
export const dynamic = 'force-dynamic'

const PROGRAMME_YEAR = '2026/2027'

export default async function ReadinessPage() {
  const user = await requireFundingAdmin()
  const items = await getReadinessItems(user.schoolId!, PROGRAMME_YEAR)
  const canManage = hasFundingPermission(user, 'funding.manage_core')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FundingBackLink />
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Programme readiness {PROGRAMME_YEAR}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          The preconditions to have in place before funding agreements can be activated this
          programme year. Track each item&apos;s status and deadline.
        </p>
      </div>
      <ReadinessPanel items={items} programmeYear={PROGRAMME_YEAR} canManage={canManage} />
    </div>
  )
}
