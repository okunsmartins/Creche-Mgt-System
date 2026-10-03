'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { markRegisterAction } from '@/lib/collection/actions'
import { REGISTER_STATUS_LABELS, type RegisterStatus } from '@/lib/collection/collection'

export interface RegisterChild {
  studentId: string
  childName: string
  status: string
  collectors: { id: string; name: string }[]
}
export interface RegisterRunGroup {
  runId: string
  runName: string
  originSchoolName: string
  children: RegisterChild[]
}

const STATUS_VARIANT: Record<RegisterStatus, 'success' | 'warning' | 'error' | 'default'> = {
  scheduled: 'default',
  collected: 'warning',
  released: 'success',
  absent: 'error',
}

export function RegisterPanel({ groups, date }: { groups: RegisterRunGroup[]; date: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // studentId whose "release to…" picker is open.
  const [releasing, setReleasing] = useState<string | null>(null)

  function mark(runId: string, studentId: string, status: RegisterStatus, collectorId?: string) {
    setError(null)
    startTransition(async () => {
      const res = await markRegisterAction({
        runId,
        studentId,
        date,
        status,
        collectorId: collectorId ?? null,
      })
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        setReleasing(null)
        router.refresh()
      }
    })
  }

  const totalChildren = groups.reduce((n, g) => n + g.children.length, 0)

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
          <span className="font-medium text-text-primary">Collection day</span>
          <input
            type="date"
            value={date}
            className="input-base"
            onChange={(e) => {
              const v = e.target.value
              if (v) router.push(`/admin/collection/register?date=${v}`)
            }}
          />
        </label>
        <a
          href={`/admin/collection/register/roster?date=${date}`}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          Printable roster →
        </a>
      </div>

      {totalChildren === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No children are enrolled on any active run. Approve enrolments on the{' '}
          <a href="/admin/collection" className="text-primary hover:underline">
            collection page
          </a>{' '}
          first.
        </div>
      ) : (
        groups
          .filter((g) => g.children.length > 0)
          .map((g) => (
            <div
              key={g.runId}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-semibold text-text-primary">{g.runName}</h2>
                <p className="text-xs text-text-muted">from {g.originSchoolName}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="px-4 py-2">Child</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {g.children.map((c) => {
                    const status = c.status as RegisterStatus
                    return (
                      <tr key={c.studentId} className="border-b border-border/50 align-top">
                        <td className="px-4 py-3 font-medium">{c.childName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                            {REGISTER_STATUS_LABELS[status] ?? c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {status === 'scheduled' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => mark(g.runId, c.studentId, 'collected')}
                                  disabled={isPending}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  Collected from school
                                </button>
                                <button
                                  type="button"
                                  onClick={() => mark(g.runId, c.studentId, 'absent')}
                                  disabled={isPending}
                                  className="text-xs font-medium text-text-muted hover:text-error"
                                >
                                  Absent
                                </button>
                              </>
                            )}
                            {status === 'collected' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReleasing((v) => (v === c.studentId ? null : c.studentId))
                                  }
                                  disabled={isPending}
                                  className="text-xs font-medium text-success hover:underline"
                                >
                                  {releasing === c.studentId ? 'Close' : 'Release to collector'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => mark(g.runId, c.studentId, 'scheduled')}
                                  disabled={isPending}
                                  className="text-xs font-medium text-text-muted hover:text-error"
                                >
                                  Undo
                                </button>
                              </>
                            )}
                            {status === 'released' && (
                              <button
                                type="button"
                                onClick={() => mark(g.runId, c.studentId, 'collected')}
                                disabled={isPending}
                                className="text-xs font-medium text-text-muted hover:text-error"
                              >
                                Undo release
                              </button>
                            )}
                            {status === 'absent' && (
                              <button
                                type="button"
                                onClick={() => mark(g.runId, c.studentId, 'scheduled')}
                                disabled={isPending}
                                className="text-xs font-medium text-text-muted hover:underline"
                              >
                                Undo
                              </button>
                            )}
                          </div>

                          {releasing === c.studentId && status === 'collected' && (
                            <div className="mt-3 rounded-lg border border-border bg-background p-3 text-left">
                              {c.collectors.length === 0 ? (
                                <p className="text-xs text-text-muted">
                                  No approved collectors for this child. Add one on the{' '}
                                  <a
                                    href="/admin/collectors"
                                    className="text-primary hover:underline"
                                  >
                                    collectors page
                                  </a>
                                  .
                                </p>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <span className="text-xs font-medium text-text-primary">
                                    Released to:
                                  </span>
                                  {c.collectors.map((col) => (
                                    <button
                                      key={col.id}
                                      type="button"
                                      onClick={() => mark(g.runId, c.studentId, 'released', col.id)}
                                      disabled={isPending}
                                      className="rounded-md border border-border px-3 py-1.5 text-left text-xs font-medium hover:border-primary hover:text-primary"
                                    >
                                      {col.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
      )}
    </div>
  )
}
