import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, ExternalLink, ImageIcon, Inbox } from 'lucide-react'
import { requireParent } from '@/lib/auth/guards'
import { getParentChildrenWithAssignments } from '@/lib/assignments/queries'
import { formatFileSize } from '@/lib/assignments/validate'
import { AssignmentUploader } from '@/components/assignments/AssignmentUploader'
import { AssignmentDeleteButton } from '@/components/assignments/AssignmentDeleteButton'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Assignments' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ParentAssignmentsPage() {
  const parent = await requireParent()
  const children = await getParentChildrenWithAssignments(parent.id)

  const childOptions: SelectOption[] = children.map((c) => ({
    value: c.studentId,
    label: `${c.firstName} ${c.lastName}${c.className ? ` — ${c.className}` : ''}`,
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Assignments</h1>
      <p className="mb-6 text-sm text-text-muted">
        Snap a photo of your child&apos;s work or upload a PDF. Only you and your child&apos;s
        school can see it.
      </p>

      {children.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-text-muted">
            You have no linked children yet. Link a child first, then you can upload their work
            here.
          </p>
          <Link
            href="/parent/children"
            className="mt-3 inline-block font-semibold text-primary hover:underline"
          >
            Go to My Children →
          </Link>
        </div>
      ) : (
        <>
          <section className="mb-8 rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Upload an assignment</h2>
            <AssignmentUploader childOptions={childOptions} />
          </section>

          <section className="space-y-6">
            {children.map((c) => (
              <div key={c.studentId}>
                <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-text-primary">
                  {c.firstName} {c.lastName}
                  {c.className && (
                    <span className="text-sm font-normal text-text-muted">{c.className}</span>
                  )}
                </h2>

                {c.assignments.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-5 text-sm text-text-muted">
                    <Inbox className="h-4 w-4" aria-hidden="true" />
                    No uploads yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {c.assignments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 bg-surface px-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised">
                          {a.fileKind === 'image' ? (
                            <ImageIcon className="h-5 w-5 text-text-muted" aria-hidden="true" />
                          ) : (
                            <FileText className="h-5 w-5 text-text-muted" aria-hidden="true" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {a.title || a.originalFilename || 'Assignment'}
                          </p>
                          <p className="text-xs text-text-muted">
                            {formatDate(a.createdAt)} · {formatFileSize(a.fileSizeBytes)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          {a.url && (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              View
                            </a>
                          )}
                          <AssignmentDeleteButton assignmentId={a.id} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
