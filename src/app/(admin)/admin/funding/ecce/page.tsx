import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getEcceRegistrations } from '@/lib/funding/queries'
import { EccePanel } from '@/components/funding/EccePanel'
import { FundingBackLink } from '@/components/funding/FundingBackLink'

export const metadata: Metadata = { title: 'ECCE Registrations | Admin' }
export const dynamic = 'force-dynamic'

export default async function EccePage() {
  const user = await requireFundingAdmin()
  const registrations = await getEcceRegistrations(user.schoolId!)
  const canManage = hasFundingPermission(user, 'funding.manage_ecce')
  const canViewSensitive = hasFundingPermission(user, 'funding.view_sensitive_identifiers')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <FundingBackLink />
      <div>
        <h1 className="text-2xl font-bold text-text-primary">ECCE registrations</h1>
        <p className="mt-1 text-sm text-text-muted">
          Prepare ECCE registrations. For a child with an AIM Level 7 dependency the AM/PM session
          must be confirmed before a registration can be marked prepared — it affects AIM funding.
          Nothing is submitted to Hive automatically.
        </p>
      </div>
      <EccePanel
        registrations={registrations}
        canManage={canManage}
        canViewSensitive={canViewSensitive}
      />
    </div>
  )
}
