'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  generateTimesheetsForWeekAction,
  updateTimesheetAction,
  setTimesheetApprovalAction,
  deleteTimesheetAction,
} from '@/lib/rota/timesheet-actions'
import { formatHours } from '@/lib/rota/rota'
import {
  formatVariance,
  TIMESHEET_STATUS_LABELS,
  type TimesheetStatus,
} from '@/lib/rota/timesheets'
import type { TimesheetWeek, TimesheetEntry } from '@/lib/rota/timesheet-queries'

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
const hhmm = (t: string) => t.slice(0, 5)

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>) => void

function TimesheetRow({
  e,
  isPending,
  run,
}: {
  e: TimesheetEntry
  isPending: boolean
  run: RunFn
}) {
  const [start, setStart] = useState(hhmm(e.actualStart))
  const [end, setEnd] = useState(hhmm(e.actualEnd))
  const [reason, setReason] = useState('')
  const status = e.status as TimesheetStatus
  const locked = status === 'APPROVED'

  // Reset local edits to the server values after a successful save (props change).
  useEffect(() => {
    setStart(hhmm(e.actualStart))
    setEnd(hhmm(e.actualEnd))
    setReason('')
  }, [e.actualStart, e.actualEnd])

  const dirty = start !== hhmm(e.actualStart) || end !== hhmm(e.actualEnd)
  const canSave = dirty && reason.trim() !== ''

  function save() {
    if (!canSave) return
    run(() =>
      updateTimesheetAction({
        id: e.id,
        actualStart: start,
        actualEnd: end,
        reason: reason.trim(),
      }),
    )
  }

  return (
    <tr className="border-b border-border/50 align-top">
      <td className="px-3 py-2 font-medium text-text-primary">{e.teacherName}</td>
      <td className="px-3 py-2 text-text-secondary">{dayLabel(e.workDate)}</td>
      <td className="px-3 py-2 text-text-muted">
        {hhmm(e.plannedStart)}–{hhmm(e.plannedEnd)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="time"
            className="input-base w-28"
            value={start}
            disabled={isPending || locked}
            onChange={(ev) => setStart(ev.target.value)}
          />
          <span className="text-text-muted">–</span>
          <input
            type="time"
            className="input-base w-28"
            value={end}
            disabled={isPending || locked}
            onChange={(ev) => setEnd(ev.target.value)}
          />
        </div>
        {dirty && !locked && (
          <div className="mt-1.5">
            <input
              type="text"
              className="input-base w-full text-xs"
              placeholder="Reason for adjustment (required)"
              value={reason}
              disabled={isPending}
              onChange={(ev) => setReason(ev.target.value)}
              aria-label="Reason for adjustment"
            />
          </div>
        )}
        {!dirty && e.lastAdjustmentReason && (
          <p className="mt-1 text-xs text-text-muted" title={e.lastAdjustmentReason}>
            Adjusted ({e.adjustmentCount}): {e.lastAdjustmentReason}
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-text-secondary">
        {formatHours(e.actualMinutes)}
        <span className="ml-1 text-xs text-text-muted">({formatVariance(e.varianceMinutes)})</span>
      </td>
      <td className="px-3 py-2">
        <Badge variant={locked ? 'success' : 'warning'}>
          {TIMESHEET_STATUS_LABELS[status] ?? e.status}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2 text-xs font-medium">
          {dirty && !locked && (
            <button
              type="button"
              onClick={save}
              disabled={isPending || !canSave}
              className="text-primary hover:underline disabled:opacity-40"
              title={canSave ? 'Save adjustment' : 'Enter a reason to save'}
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => run(() => setTimesheetApprovalAction({ id: e.id, approved: !locked }))}
            disabled={isPending || dirty}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {locked ? 'Reopen' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => run(() => deleteTimesheetAction(e.id))}
            disabled={isPending}
            className="text-error hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  )
}

export function TimesheetBoard({
  week,
  prevWeek,
  nextWeek,
}: {
  week: TimesheetWeek
  prevWeek: string
  nextWeek: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run: RunFn = (fn) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  function generate() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await generateTimesheetsForWeekAction(week.weekStart)
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        setNotice(
          res.created === 0
            ? 'All rostered shifts this week already have timesheets.'
            : `Generated ${res.created} timesheet${res.created === 1 ? '' : 's'} from the rota.`,
        )
        router.refresh()
      }
    })
  }

  const label = (iso: string) => dayLabel(iso)

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/admin/timesheets?week=${prevWeek}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          ← Previous week
        </a>
        <span className="text-sm font-medium text-text-secondary">
          {label(week.weekStart)} – {label(nextWeek)}
        </span>
        <a
          href={`/admin/timesheets?week=${nextWeek}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          Next week →
        </a>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-muted">
            Generate timesheets from this week&apos;s rostered shifts, then adjust the actual hours
            and approve them.
          </p>
          <Button type="button" loading={isPending} onClick={generate}>
            Generate from rota
          </Button>
        </div>
      </div>

      {week.entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No timesheets for this week yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Planned</th>
                <th className="px-3 py-2">Actual</th>
                <th className="px-3 py-2">Worked</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {week.entries.map((e) => (
                <TimesheetRow key={e.id} e={e} isPending={isPending} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-text-primary">Weekly hours by staff</h2>
        {week.staffTotals.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">No timesheets this week yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {week.staffTotals.map((t) => (
              <li key={t.teacherId} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span className="text-text-primary">{t.name}</span>
                <span className="text-text-secondary">
                  <span className="font-medium text-success">
                    {formatHours(t.approvedMinutes)} approved
                  </span>{' '}
                  · {formatHours(t.totalMinutes)} total
                  {t.pending > 0 && (
                    <span className="ml-1 text-warning">· {t.pending} pending</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
