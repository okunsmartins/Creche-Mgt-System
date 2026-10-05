'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { seedReadinessAction, setReadinessItemAction } from '@/lib/funding/ecce-actions'
import {
  READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  type ReadinessStatus,
} from '@/lib/funding/readiness'
import type { ReadinessItemView } from '@/lib/funding/queries'

const VARIANT: Record<ReadinessStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  CURRENT: 'success',
  SUBMITTED: 'info',
  REVIEW_REQUIRED: 'warning',
  MISSING: 'error',
  NOT_APPLICABLE: 'default',
}

export function ReadinessPanel({
  items,
  programmeYear,
  canManage,
}: {
  items: ReadinessItemView[]
  programmeYear: string
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">
            The {programmeYear} readiness checklist hasn&apos;t been set up yet.
          </p>
          {canManage && (
            <div className="mt-4">
              <Button
                type="button"
                loading={isPending}
                onClick={() => run(() => seedReadinessAction(programmeYear))}
              >
                Set up {programmeYear} checklist
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const status = i.status as ReadinessStatus
              return (
                <tr key={i.id} className="border-b border-border/50 align-top">
                  <td className="px-4 py-3 font-medium text-text-primary">{i.label}</td>
                  <td className="px-4 py-3 text-text-secondary">{i.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        className="input-base"
                        defaultValue={i.status}
                        disabled={isPending}
                        onChange={(e) =>
                          run(() =>
                            setReadinessItemAction({ itemId: i.id, status: e.target.value }),
                          )
                        }
                      >
                        {READINESS_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {READINESS_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={VARIANT[status] ?? 'default'}>
                        {READINESS_STATUS_LABELS[status] ?? i.status}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <input
                        type="date"
                        className="input-base"
                        defaultValue={i.dueDate ?? ''}
                        disabled={isPending}
                        onChange={(e) =>
                          run(() =>
                            setReadinessItemAction({
                              itemId: i.id,
                              status: i.status,
                              dueDate: e.target.value || null,
                            }),
                          )
                        }
                      />
                    ) : (
                      <span className="text-text-secondary">{i.dueDate ?? '—'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
