import type { Metadata } from 'next'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { requireFeature } from '@/lib/subscriptions/access'
import { ImportStudentsForm } from '@/components/students/ImportStudentsForm'

export const metadata: Metadata = { title: 'Import Students | Admin' }

export default async function ImportStudentsPage() {
  const admin = await requireAdmin()
  // Pro-gated — non-Pro schools are redirected to /pricing.
  await requireFeature('csv_import', admin.schoolId!)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/students" className="text-sm text-primary hover:underline">
          ← Students
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Import students from CSV</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bulk-add pupils from a spreadsheet export. Existing pupils (same name + class) are
          skipped.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-text-primary">New here? Start with the template.</p>
          <p className="mt-0.5 text-text-muted">
            Download the CSV, fill in your pupils (opens in Excel or Google Sheets), then upload it
            below. Keep the header row and make each <strong>Class</strong> match one of your
            school&apos;s classes.
          </p>
          <a
            href="/student-import-template.csv"
            download
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV template
          </a>
        </div>
      </div>

      <div className="card p-6">
        <ImportStudentsForm />
      </div>
    </div>
  )
}
