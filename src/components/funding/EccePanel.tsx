'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import {
  updateEcceRegistrationAction,
  markEcceReadyAction,
  markEcceSubmittedAction,
} from '@/lib/funding/ecce-actions'
import { revealIdentifierAction } from '@/lib/funding/sensitive-actions'
import { ECCE_SESSIONS, ECCE_SESSION_LABELS } from '@/lib/funding/ecce'
import type { EcceRegistrationView } from '@/lib/funding/queries'

export function EccePanel({
  registrations,
  canManage,
  canViewSensitive = false,
}: {
  registrations: EcceRegistrationView[]
  canManage: boolean
  canViewSensitive?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Revealed PPSN values are held transiently in component state only — never persisted.
  const [revealedPpsn, setRevealedPpsn] = useState<Record<string, string>>({})

  function reveal(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await revealIdentifierAction({ registrationId: id, field: 'PPSN' })
      if (!res.ok) setError(res.error ?? 'Could not reveal the PPSN.')
      else setRevealedPpsn((prev) => ({ ...prev, [id]: res.value }))
    })
  }

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const res = await fn()
      setBusyId(null)
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  if (registrations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No ECCE registrations yet. Add an ECCE funding registration for a child first.
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
              <th className="px-4 py-2">Child</th>
              <th className="px-4 py-2">PPSN</th>
              <th className="px-4 py-2">Session</th>
              <th className="px-4 py-2">AIM L7</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => {
              const submitted = !!r.submittedAt
              const prepared = !!r.preparedAt
              return (
                <tr key={r.id} className="border-b border-border/50 align-top">
                  <td className="px-4 py-3 font-medium text-text-primary">{r.childName}</td>
                  <td className="px-4 py-3">
                    {revealedPpsn[r.id] ? (
                      <span className="font-mono text-text-primary">{revealedPpsn[r.id]}</span>
                    ) : r.ppsnPresent ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success">On file</Badge>
                        {canViewSensitive && (
                          <button
                            type="button"
                            onClick={() => reveal(r.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            Reveal
                          </button>
                        )}
                      </div>
                    ) : (
                      <Badge variant="error">Missing</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !submitted ? (
                      <select
                        className="input-base"
                        defaultValue={r.session ?? ''}
                        disabled={isPending}
                        onChange={(e) =>
                          run(r.id, () =>
                            updateEcceRegistrationAction({
                              registrationId: r.id,
                              session: e.target.value,
                            }),
                          )
                        }
                      >
                        <option value="" disabled>
                          Set…
                        </option>
                        {ECCE_SESSIONS.map((s) => (
                          <option key={s} value={s}>
                            {ECCE_SESSION_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-text-secondary">
                        {r.session
                          ? ECCE_SESSION_LABELS[r.session as (typeof ECCE_SESSIONS)[number]]
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !submitted ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        defaultChecked={r.aimLevel7}
                        disabled={isPending}
                        onChange={(e) =>
                          run(r.id, () =>
                            updateEcceRegistrationAction({
                              registrationId: r.id,
                              aimLevel7: e.target.checked,
                            }),
                          )
                        }
                      />
                    ) : r.aimLevel7 ? (
                      'Yes'
                    ) : (
                      'No'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {submitted ? (
                      <Badge variant="success">Submitted to Hive</Badge>
                    ) : prepared ? (
                      <Badge variant="info">Prepared</Badge>
                    ) : (
                      <Badge variant="default">Draft</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && !submitted && (
                      <div className="flex flex-wrap justify-end gap-2 text-xs font-medium">
                        {!prepared && (
                          <button
                            type="button"
                            onClick={() => run(r.id, () => markEcceReadyAction(r.id))}
                            disabled={isPending && busyId === r.id}
                            className="text-primary hover:underline disabled:opacity-50"
                          >
                            Mark prepared
                          </button>
                        )}
                        {prepared && (
                          <button
                            type="button"
                            onClick={() => run(r.id, () => markEcceSubmittedAction(r.id))}
                            disabled={isPending && busyId === r.id}
                            className="text-success hover:underline disabled:opacity-50"
                          >
                            Mark submitted to Hive
                          </button>
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
    </div>
  )
}
