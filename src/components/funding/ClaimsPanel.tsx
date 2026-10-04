'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  saveClaimAction,
  transitionClaimAction,
  type ClaimActionState,
} from '@/lib/funding/claim-actions'
import { computeCopayment, CLAIM_STATUS_LABELS, type ClaimStatus } from '@/lib/funding/copayment'
import type { NcsChildOption, ClaimView } from '@/lib/funding/queries'

const STATUS_VARIANT: Record<ClaimStatus, 'default' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'default',
  READY: 'warning',
  VERIFIED: 'info',
  SUBMITTED_EXTERNALLY: 'success',
  SUPERSEDED: 'default',
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function ClaimsPanel({
  childOptions,
  claims,
  canManage,
}: {
  childOptions: NcsChildOption[]
  claims: ClaimView[]
  canManage: boolean
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<ClaimActionState, FormData>(
    saveClaimAction,
    {},
  )
  const [open, setOpen] = useState(false)
  const [rowPending, startRow] = useTransition()
  const [rowError, setRowError] = useState<string | null>(null)
  // Live co-payment preview.
  const [fee, setFee] = useState('')
  const [ncs, setNcs] = useState('')
  const [ecce, setEcce] = useState('')
  const [disc, setDisc] = useState('')
  const eur = (s: string) => Math.max(0, Math.round(parseFloat(s || '0') * 100) || 0)
  const preview = computeCopayment({
    weeklyFeeCents: eur(fee),
    ncsSubsidyCents: eur(ncs),
    ecceSubsidyCents: eur(ecce),
    discountCents: eur(disc),
  })

  function move(id: string, to: ClaimStatus) {
    setRowError(null)
    startRow(async () => {
      const res = await transitionClaimAction(id, to)
      if (!res.ok) setRowError(res.error ?? 'Could not update the claim.')
      else router.refresh()
    })
  }

  useEffect(() => {
    if (state.success) setOpen(false)
  }, [state.success])

  return (
    <div className="space-y-5">
      {canManage && (
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={childOptions.length === 0}
        >
          <FilePlus2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {open ? 'Cancel' : 'New NCS claim'}
        </Button>
      )}
      {childOptions.length === 0 && (
        <p className="text-xs text-text-muted">
          No active NCS children. Add an NCS funding registration first.
        </p>
      )}
      {state.success && <Alert variant="success">Claim saved.</Alert>}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {rowError && <Alert variant="error">{rowError}</Alert>}

      {open && (
        <form
          action={formAction}
          className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
        >
          <Select
            name="studentId"
            label="Child"
            required
            options={childOptions.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a child"
          />
          <Input
            name="startDate"
            label="Claim start date"
            type="date"
            required
            defaultValue={todayISO()}
          />
          <Input name="endDate" label="End date (optional)" type="date" />
          <Input name="termHours" label="Term weekly hours" type="number" min="0" step="0.5" />
          <Input
            name="nonTermHours"
            label="Non-term weekly hours"
            type="number"
            min="0"
            step="0.5"
          />
          <Input
            name="weeklyFee"
            label="Weekly fee (€)"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
          <Input
            name="ncsSubsidy"
            label="NCS subsidy (€)"
            type="number"
            min="0"
            step="0.01"
            value={ncs}
            onChange={(e) => setNcs(e.target.value)}
          />
          <Input
            name="ecceSubsidy"
            label="ECCE subsidy (€)"
            type="number"
            min="0"
            step="0.01"
            value={ecce}
            onChange={(e) => setEcce(e.target.value)}
          />
          <Input
            name="discount"
            label="Discount (€)"
            type="number"
            min="0"
            step="0.01"
            value={disc}
            onChange={(e) => setDisc(e.target.value)}
          />
          <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-text-secondary sm:col-span-2">
            Calculated parent co-payment:{' '}
            <span className="font-semibold text-text-primary">{formatCurrency(preview)}</span>
            <span className="text-text-muted"> / week (fee − NCS − ECCE − discount)</span>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={isPending}>
              Save claim
            </Button>
          </div>
        </form>
      )}

      {claims.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No NCS claims prepared yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-2">Child</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">Co-payment/wk</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => {
                const status = c.status as ClaimStatus
                const copay = c.overrideCents ?? c.calculatedCopaymentCents ?? 0
                return (
                  <tr key={c.id} className="border-b border-border/50 align-top">
                    <td className="px-4 py-3 font-medium text-text-primary">{c.childName}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.startDate}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatCurrency(copay)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {CLAIM_STATUS_LABELS[status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex flex-wrap justify-end gap-2 text-xs font-medium">
                          {status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => move(c.id, 'READY')}
                              disabled={rowPending}
                              className="text-primary hover:underline"
                            >
                              Mark ready
                            </button>
                          )}
                          {status === 'READY' && (
                            <>
                              <button
                                type="button"
                                onClick={() => move(c.id, 'VERIFIED')}
                                disabled={rowPending}
                                className="text-success hover:underline"
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => move(c.id, 'DRAFT')}
                                disabled={rowPending}
                                className="text-text-muted hover:text-error"
                              >
                                Back to draft
                              </button>
                            </>
                          )}
                          {status === 'VERIFIED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => move(c.id, 'SUBMITTED_EXTERNALLY')}
                                disabled={rowPending}
                                className="text-success hover:underline"
                              >
                                Mark submitted to Hive
                              </button>
                              <button
                                type="button"
                                onClick={() => move(c.id, 'READY')}
                                disabled={rowPending}
                                className="text-text-muted hover:text-error"
                              >
                                Back to ready
                              </button>
                            </>
                          )}
                          {status === 'SUBMITTED_EXTERNALLY' && (
                            <span className="text-text-muted">Submitted</span>
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
      )}
    </div>
  )
}
