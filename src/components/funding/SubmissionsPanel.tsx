'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  prepareNcsWeeklyReturnSnapshotAction,
  markSubmissionSubmittedAction,
} from '@/lib/funding/submission-actions'
import {
  SUBMISSION_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  type SubmissionKind,
  type SubmissionStatus,
} from '@/lib/funding/submissions'
import type { SubmissionSnapshotView } from '@/lib/funding/queries'

const STATUS_VARIANT: Record<SubmissionStatus, 'success' | 'warning' | 'default'> = {
  PREPARED: 'warning',
  SUBMITTED_EXTERNALLY: 'success',
  SUPERSEDED: 'default',
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function SubmissionsPanel({
  snapshots,
  latestWeek,
  canPrepare,
  canSubmit,
}: {
  snapshots: SubmissionSnapshotView[]
  latestWeek: string
  canPrepare: boolean
  canSubmit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [week, setWeek] = useState(latestWeek)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        if (ok) setNotice(ok)
        router.refresh()
      }
    })
  }

  function markSubmitted(id: string) {
    const reference = window.prompt('Hive submission reference (optional):')?.trim() ?? ''
    run(
      () =>
        markSubmissionSubmittedAction(
          reference ? { snapshotId: id, reference } : { snapshotId: id },
        ),
      'Marked as submitted to Hive.',
    )
  }

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {canPrepare && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold text-text-primary">Prepare an evidence snapshot</h2>
          <p className="mt-1 text-sm text-text-muted">
            Freeze the NCS weekly return for a reporting week exactly as it stands now. The snapshot
            is immutable — a correction creates a new one that supersedes it. Hive remains the
            official portal; nothing is submitted automatically.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="text-text-secondary">Reporting week (Monday)</span>
              <input
                type="date"
                className="input-base mt-1"
                value={week}
                disabled={isPending}
                onChange={(e) => setWeek(e.target.value)}
              />
            </label>
            <Button
              type="button"
              loading={isPending}
              disabled={!week}
              onClick={() =>
                run(
                  () => prepareNcsWeeklyReturnSnapshotAction(week),
                  'NCS weekly-return snapshot prepared.',
                )
              }
            >
              Prepare NCS weekly return
            </Button>
          </div>
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No submission snapshots yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">For</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Rules</th>
                <th className="px-4 py-2">Prepared</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => {
                const status = s.status as SubmissionStatus
                return (
                  <tr key={s.id} className="border-b border-border/50 align-top">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {SUBMISSION_KIND_LABELS[s.kind as SubmissionKind] ?? s.kind}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{s.reference}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.itemCount}</td>
                    <td className="px-4 py-3 text-text-muted">{s.rulesVersion ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{fmt(s.preparedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {SUBMISSION_STATUS_LABELS[status] ?? s.status}
                      </Badge>
                      {s.submittedAt && (
                        <div className="mt-1 text-xs text-text-muted">
                          {fmt(s.submittedAt)}
                          {s.submissionReference ? ` · ${s.submissionReference}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canSubmit && status === 'PREPARED' && (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={isPending}
                          onClick={() => markSubmitted(s.id)}
                        >
                          Mark submitted
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
