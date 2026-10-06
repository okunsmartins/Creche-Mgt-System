'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  createAimCaseAction,
  updateAimCaseAction,
  recordAimConsentAction,
  transitionAimCaseAction,
} from '@/lib/funding/aim-actions'
import {
  AIM_LEVELS,
  AIM_STATUS_LABELS,
  AIM_CONSENT_STATUSES,
  AIM_CONSENT_LABELS,
  canTransitionAim,
  type AimStatus,
  type AimConsentStatus,
} from '@/lib/funding/aim'
import type { AimCaseView, NcsChildOption } from '@/lib/funding/queries'

const STATUS_VARIANT: Record<AimStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PREPARING: 'warning',
  CONSENT_RECORDED: 'info',
  READY: 'info',
  SUBMITTED_EXTERNALLY: 'success',
  CLOSED: 'default',
}

const CONSENT_VARIANT: Record<AimConsentStatus, 'success' | 'warning' | 'error' | 'default'> = {
  NOT_REQUESTED: 'default',
  REQUESTED: 'warning',
  GRANTED: 'success',
  DECLINED: 'error',
  WITHDRAWN: 'error',
}

// The forward transitions an admin can trigger from each status (CLOSED offered on all live).
const NEXT_STATUSES: AimStatus[] = ['CONSENT_RECORDED', 'READY', 'SUBMITTED_EXTERNALLY', 'CLOSED']

export function AimPanel({
  cases,
  childOptions,
}: {
  cases: AimCaseView[]
  childOptions: NcsChildOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newChild, setNewChild] = useState('')
  const [newLevel, setNewLevel] = useState('')

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

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-text-primary">Open an AIM case</h2>
        <p className="mt-1 text-sm text-text-muted">
          AIM is a restricted record. Open a case, record parental/guardian consent, then prepare it
          for Hive. Only a brief, non-clinical support summary is stored here.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr,auto,auto]">
          <label className="block text-sm">
            <span className="text-text-secondary">Child</span>
            <select
              className="input-base mt-1"
              value={newChild}
              disabled={isPending || childOptions.length === 0}
              onChange={(e) => setNewChild(e.target.value)}
            >
              <option value="">
                {childOptions.length === 0 ? 'No children without a case' : 'Select a child…'}
              </option>
              {childOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Level (optional)</span>
            <select
              className="input-base mt-1"
              value={newLevel}
              disabled={isPending}
              onChange={(e) => setNewLevel(e.target.value)}
            >
              <option value="">—</option>
              {AIM_LEVELS.map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              loading={isPending}
              disabled={!newChild}
              onClick={() =>
                run(() => {
                  const payload: { studentId: string; level?: number } = { studentId: newChild }
                  if (newLevel) payload.level = Number(newLevel)
                  return createAimCaseAction(payload)
                }, 'AIM case opened.')
              }
            >
              Open case
            </Button>
          </div>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No AIM cases yet.
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const status = c.status as AimStatus
            const consent = c.consentStatus as AimConsentStatus
            return (
              <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-text-primary">
                    {c.childName}
                    {c.aimLevel != null && (
                      <span className="ml-2 text-sm font-normal text-text-muted">
                        Level {c.aimLevel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={CONSENT_VARIANT[consent] ?? 'default'}>
                      Consent: {AIM_CONSENT_LABELS[consent] ?? c.consentStatus}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                      {AIM_STATUS_LABELS[status] ?? c.status}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-text-secondary">AIM level</span>
                    <select
                      className="input-base mt-1"
                      defaultValue={c.aimLevel ?? ''}
                      disabled={isPending}
                      onChange={(e) =>
                        run(() =>
                          updateAimCaseAction({
                            caseId: c.id,
                            level: e.target.value ? Number(e.target.value) : null,
                          }),
                        )
                      }
                    >
                      <option value="">—</option>
                      {AIM_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          Level {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-text-secondary">Consent</span>
                    <select
                      className="input-base mt-1"
                      defaultValue={c.consentStatus}
                      disabled={isPending}
                      onChange={(e) =>
                        run(
                          () =>
                            recordAimConsentAction({ caseId: c.id, consentStatus: e.target.value }),
                          'Consent recorded.',
                        )
                      }
                    >
                      {AIM_CONSENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {AIM_CONSENT_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block text-sm">
                  <span className="text-text-secondary">Support summary (non-clinical)</span>
                  <textarea
                    className="input-base mt-1 min-h-[70px]"
                    defaultValue={c.supportSummary ?? ''}
                    disabled={isPending}
                    placeholder="Brief summary of the in-room support — no health or diagnostic detail."
                    onBlur={(e) => {
                      if ((e.target.value ?? '') !== (c.supportSummary ?? ''))
                        run(
                          () =>
                            updateAimCaseAction({ caseId: c.id, supportSummary: e.target.value }),
                          'Saved.',
                        )
                    }}
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  {NEXT_STATUSES.filter((to) => canTransitionAim(status, to)).map((to) => (
                    <Button
                      key={to}
                      type="button"
                      variant={to === 'CLOSED' ? 'secondary' : 'primary'}
                      loading={isPending}
                      onClick={() =>
                        run(
                          () => transitionAimCaseAction({ caseId: c.id, to }),
                          `Moved to ${AIM_STATUS_LABELS[to]}.`,
                        )
                      }
                    >
                      {to === 'SUBMITTED_EXTERNALLY'
                        ? 'Mark submitted to Hive'
                        : AIM_STATUS_LABELS[to]}
                    </Button>
                  ))}
                </div>
                {c.submittedAt && (
                  <p className="mt-2 text-xs text-text-muted">
                    Submitted {new Date(c.submittedAt).toLocaleDateString('en-IE')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
