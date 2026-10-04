'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, AlertTriangle, ClipboardList, Info, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import {
  runWeeklyComplianceAction,
  updateHiveActionAction,
  type FundingActionState,
} from '@/lib/funding/actions'
import type { FundingDashboard as DashboardData, HiveActionView } from '@/lib/funding/queries'

const SEV_BADGE: Record<HiveActionView['severity'], 'error' | 'warning' | 'default'> = {
  URGENT: 'error',
  ACTION: 'warning',
  INFO: 'default',
}

export function FundingDashboard({
  data,
  weekStart,
  canManage,
}: {
  data: DashboardData
  weekStart: string
  canManage: boolean
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<FundingActionState, FormData>(
    runWeeklyComplianceAction,
    {},
  )
  const [rowPending, startRow] = useTransition()
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function resolve(id: string, status: 'COMPLETED' | 'DISMISSED_WITH_REASON') {
    setRowError(null)
    let reason = ''
    if (status === 'DISMISSED_WITH_REASON') {
      reason = window.prompt('Reason for dismissing this action?')?.trim() ?? ''
      if (!reason) return
    }
    setBusyId(id)
    startRow(async () => {
      const res = await updateHiveActionAction(
        status === 'DISMISSED_WITH_REASON'
          ? { actionId: id, status, reason }
          : { actionId: id, status },
      )
      setBusyId(null)
      if (!res.ok) setRowError(res.error ?? 'Could not update the action.')
      else router.refresh()
    })
  }

  const cards = [
    { label: 'Urgent', value: data.severityCounts.URGENT, icon: AlertTriangle, tone: 'text-error' },
    {
      label: 'Action needed',
      value: data.severityCounts.ACTION,
      icon: ClipboardList,
      tone: 'text-warning',
    },
    { label: 'For info', value: data.severityCounts.INFO, icon: Info, tone: 'text-text-muted' },
  ]

  return (
    <div className="space-y-6">
      {/* Programme card — NCS (Phase 1) */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-text-primary">NCS weekly compliance</h2>
            <p className="text-sm text-text-muted">
              {data.latestWeek ? (
                <>
                  Week of {formatDate(data.latestWeek.weekStart)}: {data.latestWeek.total} active
                  NCS {data.latestWeek.total === 1 ? 'child' : 'children'}; {data.latestWeek.clear}{' '}
                  clear;{' '}
                  <span className="font-medium text-text-primary">{data.latestWeek.review}</span>{' '}
                  need review.
                </>
              ) : (
                <>No compliance has been built yet. Run the latest week to begin.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/admin/funding/ncs-weekly"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
            >
              Weekly return →
            </a>
            {canManage && (
              <form action={formAction}>
                <input type="hidden" name="weekStart" value={weekStart} />
                <Button type="submit" loading={isPending}>
                  <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Run this week&apos;s compliance
                </Button>
              </form>
            )}
          </div>
        </div>
        {state.error && (
          <Alert variant="error" className="mt-3">
            {state.error}
          </Alert>
        )}
        {state.success && state.summary && (
          <Alert variant="success" className="mt-3">
            Built {formatDate(state.summary.weekStart)}: {state.summary.totalChildren} children,{' '}
            {state.summary.review} need review, {state.summary.actionsCreated} action
            {state.summary.actionsCreated === 1 ? '' : 's'} created.
          </Alert>
        )}
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.tone}`} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {c.label}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-text-primary">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Action queue */}
      <div>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Hive actions required</h2>
        {rowError && (
          <Alert variant="error" className="mb-3">
            {rowError}
          </Alert>
        )}
        {data.openActions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            Nothing needs attention right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.openActions.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEV_BADGE[a.severity]}>{a.severity}</Badge>
                    <span className="text-xs font-medium text-text-muted">{a.programme}</span>
                    {a.childName && (
                      <span className="text-sm font-semibold text-text-primary">{a.childName}</span>
                    )}
                  </div>
                  {a.dueAt && (
                    <span className="text-xs text-text-muted">Due {formatDate(a.dueAt)}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary">{a.description}</p>
                {canManage && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => resolve(a.id, 'COMPLETED')}
                      disabled={rowPending && busyId === a.id}
                      className="text-xs font-medium text-success hover:underline disabled:opacity-50"
                    >
                      Mark done
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(a.id, 'DISMISSED_WITH_REASON')}
                      disabled={rowPending && busyId === a.id}
                      className="text-xs font-medium text-text-muted hover:text-error disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
