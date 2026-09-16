import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { requireParent } from '@/lib/auth/guards'
import { getParentPermissionSlips } from '@/lib/permission-slips/queries'
import { Badge } from '@/components/ui/Badge'
import { PermissionSlipResponder } from '@/components/permission-slips/PermissionSlipResponder'

export const metadata: Metadata = { title: 'Permission Slips' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ParentPermissionSlipsPage() {
  const parent = await requireParent()
  const children = await getParentPermissionSlips(parent.id)

  const hasSlips = children.some((c) => c.slips.length > 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Permission slips</h1>
      <p className="mb-6 text-sm text-text-muted">
        Grant or decline permission for your child&apos;s school activities.
      </p>

      {children.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-text-muted">
            You have no linked children yet. Link a child to see their permission slips.
          </p>
          <Link
            href="/parent/children"
            className="mt-3 inline-block font-semibold text-primary hover:underline"
          >
            Go to My Children →
          </Link>
        </div>
      ) : !hasSlips ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-8 text-sm text-text-muted">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          No permission slips right now.
        </div>
      ) : (
        <div className="space-y-8">
          {children
            .filter((c) => c.slips.length > 0)
            .map((c) => (
              <section key={c.studentId}>
                <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-text-primary">
                  {c.firstName} {c.lastName}
                  {c.className && (
                    <span className="text-sm font-normal text-text-muted">{c.className}</span>
                  )}
                </h2>
                <div className="space-y-4">
                  {c.slips.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border bg-surface p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-text-primary">{s.title}</h3>
                        {s.response === null ? (
                          <Badge variant="warning">Awaiting your response</Badge>
                        ) : s.response.consent ? (
                          <Badge variant="success">Granted</Badge>
                        ) : (
                          <Badge variant="error">Declined</Badge>
                        )}
                      </div>
                      {s.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                          {s.description}
                        </p>
                      )}
                      {s.dueDate && (
                        <p className="mt-2 text-xs font-medium text-text-muted">
                          Please respond by {formatDate(s.dueDate)}
                        </p>
                      )}
                      <PermissionSlipResponder
                        slipId={s.id}
                        studentId={c.studentId}
                        initialConsent={s.response?.consent ?? null}
                        initialNote={s.response?.note ?? null}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
