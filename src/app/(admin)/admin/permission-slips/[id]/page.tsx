import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { getSlipDetail } from '@/lib/permission-slips/queries'
import { SlipResponsesTable } from '@/components/permission-slips/SlipResponsesTable'

export const metadata: Metadata = { title: 'Permission Slip | Admin' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminSlipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }
  const { id } = await params
  const detail = await getSlipDetail(id, admin.schoolId)
  if (!detail) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-sm text-text-muted">
        <Link href="/admin/permission-slips" className="hover:text-primary hover:underline">
          Permission slips
        </Link>
        {' / '}
        <span className="text-text-primary">{detail.title}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">{detail.title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {detail.audienceLabel}
          {detail.dueDate ? ` · due ${formatDate(detail.dueDate)}` : ''}
        </p>
        {detail.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
            {detail.description}
          </p>
        )}
      </div>

      <SlipResponsesTable tally={detail.tally} students={detail.students} />
    </div>
  )
}
