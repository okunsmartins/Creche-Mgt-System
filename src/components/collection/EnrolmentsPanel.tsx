'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  enrolChildByStaffAction,
  reviewEnrolmentAction,
  generateCollectionChargeAction,
} from '@/lib/collection/actions'
import {
  ENROLMENT_STATUS_LABELS,
  CHARGE_BASIS_UNIT,
  computeCollectionCharge,
  type EnrolmentStatus,
  type ChargeBasis,
} from '@/lib/collection/collection'

export interface EnrolmentRow {
  id: string
  childName: string
  runName: string
  chargeBasis: string
  priceCents: number
  status: string
  requestedBy: string
  consentGiven: boolean
}
export interface ChildOption {
  id: string
  first_name: string | null
  last_name: string | null
}
export interface RunOption {
  id: string
  name: string
}

const STATUS_VARIANT: Record<EnrolmentStatus, 'success' | 'warning' | 'error' | 'default'> = {
  approved: 'success',
  requested: 'warning',
  declined: 'error',
  ended: 'default',
}

export function EnrolmentsPanel({
  enrolments,
  childOptions,
  runOptions,
}: {
  enrolments: EnrolmentRow[]
  childOptions: ChildOption[]
  runOptions: RunOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [chargeFor, setChargeFor] = useState<string | null>(null)

  const childName = (c: ChildOption) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed child'

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        after?.()
        router.refresh()
      }
    })
  }

  function submitEnrol(form: HTMLFormElement) {
    const fd = new FormData(form)
    const studentId = (fd.get('studentId') as string) ?? ''
    const runId = (fd.get('runId') as string) ?? ''
    if (!studentId || !runId) {
      setError('Choose a child and a run.')
      return
    }
    act(
      () => enrolChildByStaffAction({ runId, studentId }),
      () => {
        form.reset()
        setOpen(false)
      },
    )
  }

  function submitCharge(form: HTMLFormElement, enrolmentId: string) {
    const fd = new FormData(form)
    act(
      () =>
        generateCollectionChargeAction({
          enrolmentId,
          periodStart: (fd.get('periodStart') as string) ?? '',
          periodEnd: (fd.get('periodEnd') as string) ?? '',
          dueDate: (fd.get('dueDate') as string) ?? '',
          units: parseInt((fd.get('units') as string) || '0', 10),
        }),
      () => setChargeFor(null),
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={childOptions.length === 0 || runOptions.length === 0}
        >
          {open ? 'Cancel' : 'Enrol a child'}
        </Button>
        {runOptions.length === 0 && (
          <p className="mt-2 text-xs text-text-muted">Create a run first.</p>
        )}
      </div>

      {open && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault()
            submitEnrol(e.currentTarget)
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-primary">Child</span>
            <select name="studentId" required className="input-base" defaultValue="">
              <option value="" disabled>
                Select a child…
              </option>
              {childOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {childName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-primary">Run</span>
            <select name="runId" required className="input-base" defaultValue="">
              <option value="" disabled>
                Select a run…
              </option>
              {runOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={isPending}>
            Enrol
          </Button>
        </form>
      )}

      {enrolments.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No enrolments yet. Enrol a child above, or approve a parent request when it arrives.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrolments.map((e) => {
                const status = e.status as EnrolmentStatus
                return (
                  <tr key={e.id} className="border-b border-border/50 align-top">
                    <td className="px-4 py-3 font-medium">{e.childName}</td>
                    <td className="px-4 py-3">
                      {e.runName}
                      <div className="text-xs text-text-muted">
                        {formatCurrency(e.priceCents)} /{' '}
                        {CHARGE_BASIS_UNIT[e.chargeBasis as ChargeBasis] ?? e.chargeBasis}
                        {e.requestedBy === 'parent' &&
                          ` · parent request${e.consentGiven ? ' · consent given' : ''}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {ENROLMENT_STATUS_LABELS[status] ?? e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {e.status === 'requested' && (
                          <>
                            <button
                              type="button"
                              onClick={() => act(() => reviewEnrolmentAction(e.id, 'approved'))}
                              disabled={isPending}
                              className="text-xs font-medium text-success hover:underline"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => act(() => reviewEnrolmentAction(e.id, 'declined'))}
                              disabled={isPending}
                              className="text-xs font-medium text-error hover:underline"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {e.status === 'approved' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setChargeFor((v) => (v === e.id ? null : e.id))}
                              disabled={isPending}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {chargeFor === e.id ? 'Close' : 'Generate charge'}
                            </button>
                            <button
                              type="button"
                              onClick={() => act(() => reviewEnrolmentAction(e.id, 'ended'))}
                              disabled={isPending}
                              className="text-xs font-medium text-text-muted hover:text-error"
                            >
                              End
                            </button>
                          </>
                        )}
                        {(e.status === 'declined' || e.status === 'ended') && (
                          <button
                            type="button"
                            onClick={() => act(() => reviewEnrolmentAction(e.id, 'approved'))}
                            disabled={isPending}
                            className="text-xs font-medium text-success hover:underline"
                          >
                            Approve
                          </button>
                        )}
                      </div>

                      {chargeFor === e.id && (
                        <form
                          className="mt-3 grid gap-2 rounded-lg border border-border bg-background p-3 text-left sm:grid-cols-2"
                          onSubmit={(ev) => {
                            ev.preventDefault()
                            submitCharge(ev.currentTarget, e.id)
                          }}
                        >
                          <Input label="Period start" name="periodStart" type="date" required />
                          <Input label="Period end" name="periodEnd" type="date" required />
                          <Input label="Due date" name="dueDate" type="date" required />
                          <Input
                            label={`Units (${CHARGE_BASIS_UNIT[e.chargeBasis as ChargeBasis] ?? 'unit'}s)`}
                            name="units"
                            type="number"
                            min="1"
                            defaultValue="1"
                            required
                          />
                          <p className="text-xs text-text-muted sm:col-span-2">
                            Charge = {formatCurrency(e.priceCents)} ×{' '}
                            {CHARGE_BASIS_UNIT[e.chargeBasis as ChargeBasis] ?? 'unit'}s. Example
                            for 1: {formatCurrency(computeCollectionCharge(e.priceCents, 1))}.
                          </p>
                          <div className="sm:col-span-2">
                            <Button type="submit" disabled={isPending}>
                              Create invoice
                            </Button>
                          </div>
                        </form>
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
