'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { upsertVettingAction, deleteVettingAction } from '@/lib/vetting/actions'
import { vettingStatusLabel, vettingStatusTone } from '@/lib/vetting/vetting'
import type { VettingRow } from '@/lib/vetting/queries'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>) => void

function VettingRowView({
  row,
  isPending,
  run,
}: {
  row: VettingRow
  isPending: boolean
  run: RunFn
}) {
  const [editing, setEditing] = useState(false)
  const [reference, setReference] = useState(row.reference ?? '')
  const [vettingDate, setVettingDate] = useState(row.vettingDate ?? '')
  const [expiryDate, setExpiryDate] = useState(row.expiryDate ?? '')

  function save() {
    run(async () => {
      const res = await upsertVettingAction({
        teacherId: row.teacherId,
        reference,
        vettingDate,
        expiryDate,
      })
      if (res.ok) setEditing(false)
      return res
    })
  }

  function cancel() {
    setReference(row.reference ?? '')
    setVettingDate(row.vettingDate ?? '')
    setExpiryDate(row.expiryDate ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-border/50 align-top">
        <td className="px-3 py-2 font-medium text-text-primary">
          {row.name}
          {row.email && <div className="text-xs font-normal text-text-muted">{row.email}</div>}
        </td>
        <td className="px-3 py-2" colSpan={3}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs">
              <span className="text-text-secondary">Reference</span>
              <input
                className="input-base mt-1 w-40"
                value={reference}
                disabled={isPending}
                onChange={(e) => setReference(e.target.value)}
                placeholder="NVB reference"
              />
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Vetting date</span>
              <input
                type="date"
                className="input-base mt-1"
                value={vettingDate}
                disabled={isPending}
                onChange={(e) => setVettingDate(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Renewal due</span>
              <input
                type="date"
                className="input-base mt-1"
                value={expiryDate}
                disabled={isPending}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </label>
          </div>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="text-text-muted hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const hasRecord = row.status !== 'missing'
  return (
    <tr className="border-b border-border/50">
      <td className="px-3 py-2 font-medium text-text-primary">
        {row.name}
        {row.email && <div className="text-xs font-normal text-text-muted">{row.email}</div>}
      </td>
      <td className="px-3 py-2 text-text-secondary">{row.reference ?? '—'}</td>
      <td className="px-3 py-2 text-text-secondary">{fmtDate(row.vettingDate)}</td>
      <td className="px-3 py-2 text-text-secondary">{fmtDate(row.expiryDate)}</td>
      <td className="px-3 py-2">
        <Badge variant={vettingStatusTone(row.status)}>{vettingStatusLabel(row.status)}</Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={isPending}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {hasRecord ? 'Edit' : 'Record'}
          </button>
          {hasRecord && (
            <button
              type="button"
              onClick={() => run(() => deleteVettingAction(row.teacherId))}
              disabled={isPending}
              className="text-error hover:underline disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export function VettingBoard({ rows }: { rows: VettingRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run: RunFn = (fn) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No active staff yet. Add staff first, then record their Garda vetting here.
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
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Vetting date</th>
              <th className="px-3 py-2">Renewal due</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <VettingRowView key={row.teacherId} row={row} isPending={isPending} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
