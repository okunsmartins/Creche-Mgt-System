import type { Metadata } from 'next'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { requireParent } from '@/lib/auth/guards'
import { getParentChildrenDocuments } from '@/lib/documents/queries'
import { DocumentFileRow } from '@/components/documents/DocumentFileRow'
import type { ChildDocuments } from '@/lib/documents/queries'

export const metadata: Metadata = { title: 'Reports' }

function CategorySection({ title, students }: { title: string; students: ChildDocuments[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{title}</h2>
      <div className="space-y-5">
        {students.map((c) => (
          <div key={c.studentId}>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-text-primary">
              {c.firstName} {c.lastName}
              {c.className && (
                <span className="text-xs font-normal text-text-muted">{c.className}</span>
              )}
            </h3>
            {c.documents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-4 text-sm text-text-muted">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Nothing shared yet.
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {c.documents.map((d) => (
                  <DocumentFileRow key={d.id} doc={d} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function ParentReportsPage() {
  const parent = await requireParent()
  const [testResults, reportCards] = await Promise.all([
    getParentChildrenDocuments(parent.id, 'test_result'),
    getParentChildrenDocuments(parent.id, 'report_card'),
  ])

  // Both queries return the same child set; either being empty means no children.
  const hasChildren = testResults.length > 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Reports</h1>
      <p className="mb-6 text-sm text-text-muted">
        Test results and report cards your child&apos;s school has shared with you.
      </p>

      {!hasChildren ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-text-muted">
            You have no linked children yet. Link a child to see their reports.
          </p>
          <Link
            href="/parent/children"
            className="mt-3 inline-block font-semibold text-primary hover:underline"
          >
            Go to My Children →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <CategorySection title="Test results" students={testResults} />
          <CategorySection title="Report cards" students={reportCards} />
        </div>
      )}
    </div>
  )
}
