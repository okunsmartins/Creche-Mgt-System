import type { Metadata } from 'next'
import { requireFundingAimAdmin } from '@/lib/funding/access'
import { getAimCases, getAimChildOptions } from '@/lib/funding/queries'
import { AimPanel } from '@/components/funding/AimPanel'
import { FundingBackLink } from '@/components/funding/FundingBackLink'

export const metadata: Metadata = { title: 'AIM | Admin' }
export const dynamic = 'force-dynamic'

export default async function AimPage() {
  // Restricted: requires funding.manage_aim (notFound otherwise), not just funding.view.
  const user = await requireFundingAimAdmin()
  const [cases, childOptions] = await Promise.all([
    getAimCases(user.schoolId!),
    getAimChildOptions(user.schoolId!),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FundingBackLink />
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Access and Inclusion Model (AIM)</h1>
        <p className="mt-1 text-sm text-text-muted">
          A restricted area for preparing AIM support for Hive. Access is limited to staff granted
          the AIM permission. Record parental/guardian consent before preparing a case, and keep the
          support summary brief and non-clinical — detailed health records stay in their own module.
        </p>
      </div>
      <AimPanel cases={cases} childOptions={childOptions} />
    </div>
  )
}
