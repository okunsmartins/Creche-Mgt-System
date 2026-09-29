import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { requireFeature } from '@/lib/subscriptions/access'
import { ImportWizard } from '@/components/import/ImportWizard'

export const metadata: Metadata = { title: 'Import children | Admin' }

export default async function ImportPage() {
  const admin = await requireAdmin()
  // Pro-gated — non-Pro schools are redirected to /pricing.
  await requireFeature('csv_import', admin.schoolId!)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/dashboard" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Import from a spreadsheet</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bring your existing crèche spreadsheets straight in — choose what you&apos;re importing
          (children or staff), upload it, map your columns, review, and import. We never save
          anything until you confirm.
        </p>
      </div>

      <div className="card p-6">
        <ImportWizard />
      </div>
    </div>
  )
}
