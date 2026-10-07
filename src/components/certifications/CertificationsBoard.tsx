'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { upsertCertificationAction, deleteCertificationAction } from '@/lib/certifications/actions'
import {
  CERTIFICATION_KINDS,
  CERTIFICATION_KIND_LABELS,
  certificationStatusLabel,
  certificationStatusTone,
} from '@/lib/certifications/certifications'
import type { CertificationRow } from '@/lib/certifications/queries'

type Teacher = { id: string; name: string }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) => void

function RowView({
  row,
  isPending,
  run,
}: {
  row: CertificationRow
  isPending: boolean
  run: RunFn
}) {
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState(row.kind)
  const [name, setName] = useState(row.name)
  const [reference, setReference] = useState(row.reference ?? '')
  const [issued, setIssued] = useState(row.issuedDate ?? '')
  const [expiry, setExpiry] = useState(row.expiryDate ?? '')

  function save() {
    run(
      () =>
        upsertCertificationAction({
          id: row.id,
          teacherId: row.teacherId,
          kind,
          name,
          reference,
          issuedDate: issued,
          expiryDate: expiry,
        }),
      () => setEditing(false),
    )
  }

  if (editing) {
    return (
      <tr className="border-b border-border/50 align-top">
        <td className="px-3 py-2 font-medium text-text-primary">{row.teacherName}</td>
        <td className="px-3 py-2" colSpan={4}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-xs">
              <span className="text-text-secondary">Type</span>
              <select
                className="input-base mt-1"
                value={kind}
                disabled={isPending}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                {CERTIFICATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CERTIFICATION_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Name</span>
              <input
                className="input-base mt-1 w-44"
                value={name}
                disabled={isPending}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Reference</span>
              <input
                className="input-base mt-1 w-32"
                value={reference}
                disabled={isPending}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Issued</span>
              <input
                type="date"
                className="input-base mt-1"
                value={issued}
                disabled={isPending}
                onChange={(e) => setIssued(e.target.value)}
              />
            </label>
            <label className="block text-xs">
              <span className="text-text-secondary">Expiry</span>
              <input
                type="date"
                className="input-base mt-1"
                value={expiry}
                disabled={isPending}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
          </div>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={save}
              disabled={isPending || name.trim() === ''}
              className="text-primary hover:underline disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
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

  return (
    <tr className="border-b border-border/50">
      <td className="px-3 py-2 font-medium text-text-primary">{row.teacherName}</td>
      <td className="px-3 py-2 text-text-secondary">{CERTIFICATION_KIND_LABELS[row.kind]}</td>
      <td className="px-3 py-2 text-text-secondary">
        {row.name}
        {row.reference && <span className="ml-1 text-xs text-text-muted">({row.reference})</span>}
      </td>
      <td className="px-3 py-2 text-text-secondary">{fmtDate(row.expiryDate)}</td>
      <td className="px-3 py-2">
        <Badge variant={certificationStatusTone(row.status)}>
          {certificationStatusLabel(row.status)}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={isPending}
            className="text-primary hover:underline disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => run(() => deleteCertificationAction(row.id))}
            disabled={isPending}
            className="text-error hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

export function CertificationsBoard({
  rows,
  teachers,
}: {
  rows: CertificationRow[]
  teachers: Teacher[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Add-form state.
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '')
  const [kind, setKind] = useState<(typeof CERTIFICATION_KINDS)[number]>('qualification')
  const [name, setName] = useState('')
  const [reference, setReference] = useState('')
  const [issued, setIssued] = useState('')
  const [expiry, setExpiry] = useState('')

  const run: RunFn = (fn, onOk) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        onOk?.()
        router.refresh()
      }
    })
  }

  function add() {
    run(
      () =>
        upsertCertificationAction({
          teacherId,
          kind,
          name,
          reference,
          issuedDate: issued,
          expiryDate: expiry,
        }),
      () => {
        setName('')
        setReference('')
        setIssued('')
        setExpiry('')
      },
    )
  }

  if (teachers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No active staff yet. Add staff first, then record their qualifications and training here.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Add certification */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Add a certification</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs">
            <span className="text-text-secondary">Staff</span>
            <select
              className="input-base mt-1"
              value={teacherId}
              disabled={isPending}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-text-secondary">Type</span>
            <select
              className="input-base mt-1"
              value={kind}
              disabled={isPending}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {CERTIFICATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CERTIFICATION_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-text-secondary">Name</span>
            <input
              className="input-base mt-1 w-44"
              value={name}
              disabled={isPending}
              placeholder="e.g. First Aid, QQI Level 6"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-text-secondary">Reference</span>
            <input
              className="input-base mt-1 w-32"
              value={reference}
              disabled={isPending}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-text-secondary">Issued</span>
            <input
              type="date"
              className="input-base mt-1"
              value={issued}
              disabled={isPending}
              onChange={(e) => setIssued(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="text-text-secondary">Expiry</span>
            <input
              type="date"
              className="input-base mt-1"
              value={expiry}
              disabled={isPending}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={isPending || name.trim() === ''}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No certifications recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RowView key={row.id} row={row} isPending={isPending} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
