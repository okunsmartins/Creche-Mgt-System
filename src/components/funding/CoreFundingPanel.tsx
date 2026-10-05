'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { captureCoreSnapshotAction, flagCoreDriftAction } from '@/lib/funding/core-funding-actions'
import type { CoreFundingView } from '@/lib/funding/queries'
import type { CoreProfile, ProfileChange } from '@/lib/funding/core-funding'

const ROWS: { field: keyof CoreProfile; label: string; derived: boolean }[] = [
  { field: 'staffCount', label: 'Staff (active)', derived: true },
  { field: 'roomCount', label: 'Rooms (active)', derived: true },
  { field: 'totalCapacity', label: 'Total capacity (places)', derived: false },
  { field: 'operatingWeeks', label: 'Operating weeks', derived: false },
]

function changeFor(changes: ProfileChange[], field: keyof CoreProfile) {
  return changes.find((c) => c.field === field)
}

export function CoreFundingPanel({
  view,
  canManage,
}: {
  view: CoreFundingView
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [capacity, setCapacity] = useState(String(view.snapshot?.totalCapacity ?? ''))
  const [weeks, setWeeks] = useState(String(view.snapshot?.operatingWeeks ?? ''))

  const hasSnapshot = view.snapshot !== null
  const hasDrift = view.changes.length > 0

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

  function capture() {
    const fd = new FormData()
    fd.set('programmeYear', view.programmeYear)
    fd.set('totalCapacity', capacity)
    fd.set('operatingWeeks', weeks)
    run(() => captureCoreSnapshotAction({ ok: false }, fd), 'Snapshot captured.')
  }

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-text-primary">Verified snapshot</h2>
            <p className="text-sm text-text-muted">
              {hasSnapshot && view.snapshotCapturedAt
                ? `Last confirmed ${new Date(view.snapshotCapturedAt).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : 'No verified snapshot captured yet for this programme year.'}
            </p>
          </div>
          {hasSnapshot &&
            (hasDrift ? (
              <Badge variant="warning">Drift detected</Badge>
            ) : (
              <Badge variant="success">Matches current</Badge>
            ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2">Profile field</th>
                <th className="px-3 py-2">Verified snapshot</th>
                <th className="px-3 py-2">Current (live)</th>
                <th className="px-3 py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ field, label, derived }) => {
                const ch = changeFor(view.changes, field)
                return (
                  <tr key={field} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium text-text-primary">
                      {label}
                      {derived && <span className="ml-1 text-xs text-text-muted">· auto</span>}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {hasSnapshot ? view.snapshot![field] : '—'}
                    </td>
                    <td className="px-3 py-2 text-text-primary">{view.current[field]}</td>
                    <td className="px-3 py-2">
                      {ch ? (
                        <span className="font-medium text-warning">
                          {ch.delta > 0 ? `+${ch.delta}` : ch.delta}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasDrift && (
          <p className="mt-3 text-sm text-text-secondary">
            The current profile differs from the last verified snapshot. Creche Wise never changes
            your funding data — review whether a Review &amp; Confirm update or an application
            change is needed on Hive, then recapture the snapshot once it&apos;s confirmed.
          </p>
        )}

        {canManage && hasDrift && (
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              loading={isPending}
              onClick={() =>
                run(() => flagCoreDriftAction(view.programmeYear), 'Review action raised.')
              }
            >
              Flag drift for review
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold text-text-primary">
            {hasSnapshot ? 'Recapture snapshot' : 'Capture first snapshot'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Record the Core Funding profile you&apos;ve confirmed on Hive. Staff and room counts are
            taken automatically from your live data; enter the confirmed capacity and operating
            weeks.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-text-secondary">Total capacity (places)</span>
              <input
                type="number"
                min={0}
                className="input-base mt-1"
                value={capacity}
                disabled={isPending}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Operating weeks</span>
              <input
                type="number"
                min={0}
                max={52}
                className="input-base mt-1"
                value={weeks}
                disabled={isPending}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4">
            <Button type="button" loading={isPending} onClick={capture}>
              Capture snapshot
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
