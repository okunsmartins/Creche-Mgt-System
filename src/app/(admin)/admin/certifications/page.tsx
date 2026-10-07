import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getCertifications } from '@/lib/certifications/queries'
import { toISODate } from '@/lib/rota/rota'
import { Alert } from '@/components/ui/Alert'
import { CertificationsBoard } from '@/components/certifications/CertificationsBoard'

export const metadata: Metadata = { title: 'Qualifications & training | Admin' }
export const dynamic = 'force-dynamic'

export default async function CertificationsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const today = toISODate(new Date())
  const [overview, { data: teacherData }] = await Promise.all([
    getCertifications(admin.schoolId, today),
    createSupabaseAdminClient()
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('first_name')
      .order('last_name'),
  ])

  const teachers = (
    (teacherData as { id: string; first_name: string | null; last_name: string | null }[] | null) ??
    []
  ).map((t) => ({
    id: t.id,
    name: [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Staff member',
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Qualifications &amp; training</h1>
        <p className="mt-1 text-sm text-text-muted">
          Record each staff member&apos;s qualifications, training and other certifications with an
          expiry date. Items expired or due within 60 days are flagged here and on the dashboard.
        </p>
      </div>

      {!overview.tableReady && (
        <Alert variant="warning">
          Certification tracking isn&apos;t active yet — apply database migration{' '}
          <code>096_staff_certifications.sql</code>. Until then nothing is saved.
        </Alert>
      )}

      {overview.tableReady &&
        (overview.attention > 0 ? (
          <Alert variant="warning">
            {overview.attention} certification{overview.attention === 1 ? '' : 's'} need attention —
            expired or due for renewal within 60 days.
          </Alert>
        ) : (
          overview.rows.length > 0 && (
            <Alert variant="success">All recorded certifications are current.</Alert>
          )
        ))}

      <CertificationsBoard rows={overview.rows} teachers={teachers} />
    </div>
  )
}
