import type { Metadata } from 'next'
import { requireFundingAdmin, hasFundingPermission } from '@/lib/funding/access'
import { getClaimsForSchool, getNcsChildOptions } from '@/lib/funding/queries'
import { ClaimsPanel } from '@/components/funding/ClaimsPanel'

export const metadata: Metadata = { title: 'NCS Claims & Co-payments | Admin' }
export const dynamic = 'force-dynamic'

export default async function NcsClaimsPage() {
  const user = await requireFundingAdmin()
  const [childOptions, claims] = await Promise.all([
    getNcsChildOptions(user.schoolId!),
    getClaimsForSchool(user.schoolId!),
  ])
  const canManage = hasFundingPermission(user, 'funding.manage_ncs')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">NCS claims &amp; co-payments</h1>
        <p className="mt-1 text-sm text-text-muted">
          Prepare NCS claims and the parent co-payment (fee − NCS − ECCE − discounts). Verify, then
          mark submitted once completed on the Early Years Hive — nothing is submitted
          automatically.
        </p>
      </div>
      <ClaimsPanel childOptions={childOptions} claims={claims} canManage={canManage} />
    </div>
  )
}
