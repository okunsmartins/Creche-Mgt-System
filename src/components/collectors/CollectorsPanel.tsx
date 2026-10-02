'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { addCollectorByStaffAction, reviewCollectorAction } from '@/lib/collectors/actions'
import {
  COLLECTOR_RELATIONSHIPS,
  COLLECTOR_RELATIONSHIP_LABELS,
  COLLECTOR_STATUS_LABELS,
  type CollectorStatus,
} from '@/lib/collectors/collectors'

export interface ChildOption {
  id: string
  first_name: string | null
  last_name: string | null
}

export interface CollectorRow {
  id: string
  studentId: string
  childName: string
  fullName: string
  relationship: string
  phone: string | null
  status: string
  proposedBy: string
  canCollectUnaccompanied: boolean
  notes: string | null
}

const STATUS_VARIANT: Record<CollectorStatus, 'success' | 'warning' | 'error' | 'default'> = {
  approved: 'success',
  pending: 'warning',
  declined: 'error',
  revoked: 'default',
}

export function CollectorsPanel({
  collectors,
  childOptions,
}: {
  collectors: CollectorRow[]
  childOptions: ChildOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  function submit(form: HTMLFormElement) {
    setError(null)
    const fd = new FormData(form)
    const studentId = (fd.get('studentId') as string) ?? ''
    if (!studentId) {
      setError('Choose a child.')
      return
    }
    startTransition(async () => {
      const res = await addCollectorByStaffAction({
        studentId,
        fullName: (fd.get('fullName') as string) ?? '',
        relationship: (fd.get('relationship') as string) ?? '',
        phone: (fd.get('phone') as string) ?? '',
        password: (fd.get('password') as string) ?? '',
        canCollectUnaccompanied: fd.get('canCollectUnaccompanied') === 'on',
        notes: (fd.get('notes') as string) ?? '',
      })
      if (!res.ok) setError(res.error)
      else {
        form.reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  function review(id: string, nextStatus: string) {
    setError(null)
    startTransition(async () => {
      const res = await reviewCollectorAction(id, nextStatus)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  const childLabel = (c: ChildOption) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed child'

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={childOptions.length === 0}
        >
          {open ? 'Cancel' : 'Add collector'}
        </Button>
        {childOptions.length === 0 && (
          <p className="mt-2 text-xs text-text-muted">Add children first to assign collectors.</p>
        )}
      </div>

      {open && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit(e.currentTarget)
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
                  {childLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-primary">Relationship</span>
            <select name="relationship" required className="input-base" defaultValue="parent">
              {COLLECTOR_RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {COLLECTOR_RELATIONSHIP_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <Input label="Full name" name="fullName" required />
          <Input label="Phone" name="phone" />
          <Input
            label="Collection word (optional)"
            name="password"
            placeholder="Spoken at the door to verify"
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="canCollectUnaccompanied" className="h-4 w-4" />
            <span>May collect child unaccompanied</span>
          </label>
          <div className="sm:col-span-2">
            <Textarea label="Notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              Save collector
            </Button>
          </div>
        </form>
      )}

      {collectors.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No collectors yet. Add one above, or approve a parent-proposed collector when it arrives.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Collector</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collectors.map((c) => {
                const status = c.status as CollectorStatus
                return (
                  <tr key={c.id} className="border-b border-border/50 align-top">
                    <td className="px-4 py-3 font-medium">{c.childName}</td>
                    <td className="px-4 py-3">
                      {c.fullName}
                      <p className="mt-0.5 text-xs text-text-muted">
                        {COLLECTOR_RELATIONSHIP_LABELS[
                          c.relationship as keyof typeof COLLECTOR_RELATIONSHIP_LABELS
                        ] ?? c.relationship}
                        {c.proposedBy === 'parent' && ' · proposed by parent'}
                        {c.canCollectUnaccompanied && ' · may collect alone'}
                      </p>
                      {c.notes && (
                        <p className="mt-0.5 text-xs font-normal text-text-muted">{c.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {COLLECTOR_STATUS_LABELS[status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {c.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => review(c.id, 'approved')}
                              disabled={isPending}
                              className="text-xs font-medium text-success hover:underline"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => review(c.id, 'declined')}
                              disabled={isPending}
                              className="text-xs font-medium text-error hover:underline"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {c.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => review(c.id, 'revoked')}
                            disabled={isPending}
                            className="text-xs font-medium text-text-muted hover:text-error"
                          >
                            Revoke
                          </button>
                        )}
                        {(c.status === 'declined' || c.status === 'revoked') && (
                          <button
                            type="button"
                            onClick={() => review(c.id, 'approved')}
                            disabled={isPending}
                            className="text-xs font-medium text-success hover:underline"
                          >
                            Approve
                          </button>
                        )}
                      </div>
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
