import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getVettingOverview } from '@/lib/vetting/queries'
import { toISODate } from '@/lib/rota/rota'
import { Alert } from '@/components/ui/Alert'
import { VettingBoard } from '@/components/vetting/VettingBoard'

export const metadata: Metadata = { title: 'Garda vetting | Admin' }
export const dynamic = 'force-dynamic'

export default async function VettingPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const today = toISODate(new Date())
  const overview = await getVettingOverview(admin.schoolId, today)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Garda vetting</h1>
        <p className="mt-1 text-sm text-text-muted">
          Track each staff member&apos;s Garda (National Vetting Bureau) disclosure and renewal
          date. Renewals due within 60 days, expired vetting, and staff with none recorded are
          flagged.
        </p>
      </div>

      {!overview.tableReady && (
        <Alert variant="warning">
          Vetting tracking isn&apos;t active yet — apply database migration{' '}
          <code>094_staff_garda_vetting.sql</code>. Until then, staff show as “not recorded” and
          saving won&apos;t persist.
        </Alert>
      )}

      {overview.tableReady &&
        (overview.attention > 0 ? (
          <Alert variant="warning">
            {overview.attention} staff member{overview.attention === 1 ? '' : 's'} need attention —
            vetting expired, due for renewal, or not recorded.
          </Alert>
        ) : (
          overview.rows.length > 0 && (
            <Alert variant="success">All staff have current Garda vetting on record.</Alert>
          )
        ))}

      <VettingBoard rows={overview.rows} />
    </div>
  )
}
