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
  const canExport = hasFundingPermission(user, 'funding.export')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">NCS claims &amp; co-payments</h1>
          <p className="mt-1 text-sm text-text-muted">
            Prepare NCS claims and the parent co-payment (fee − NCS − ECCE − discounts). Verify,
            then mark submitted once completed on the Early Years Hive — nothing is submitted
            automatically.
          </p>
        </div>
        {canExport && (
          <a
            href="/api/admin/funding/claims"
            className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
          >
            Export CSV
          </a>
        )}
      </div>
      <ClaimsPanel childOptions={childOptions} claims={claims} canManage={canManage} />
    </div>
  )
}
