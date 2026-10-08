'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { setStudentLeavingDateAction } from '@/lib/places/actions'

export interface LeaverRow {
  studentId: string
  name: string
  roomName: string
  leavingDate: string
}
export interface ChildOption {
  id: string
  name: string
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export function UpcomingLeaversPanel({
  leavers,
  childOptions,
}: {
  leavers: LeaverRow[]
  childOptions: ChildOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [addChild, setAddChild] = useState('')
  const [addDate, setAddDate] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')

  function reset() {
    setAdding(false)
    setAddChild('')
    setAddDate('')
    setEditingId(null)
    setEditDate('')
  }

  function addLeaver() {
    setError(null)
    setNotice(null)
    if (!addChild) {
      setError('Select a child.')
      return
    }
    if (!addDate) {
      setError('Choose a leaving date.')
      return
    }
    startTransition(async () => {
      const res = await setStudentLeavingDateAction(addChild, addDate)
      if (!res.ok) setError(res.error)
      else {
        setNotice('Leaving date set.')
        reset()
        router.refresh()
      }
    })
  }

  function saveEdit(studentId: string) {
    setError(null)
    setNotice(null)
    if (!editDate) {
      setError('Choose a leaving date.')
      return
    }
    startTransition(async () => {
      const res = await setStudentLeavingDateAction(studentId, editDate)
      if (!res.ok) setError(res.error)
      else {
        setNotice('Leaving date updated.')
        reset()
        router.refresh()
      }
    })
  }

  function removeLeaver(studentId: string, name: string) {
    setError(null)
    setNotice(null)
    if (!window.confirm(`Clear ${name}'s leaving date? They'll no longer show as a leaver.`)) return
    startTransition(async () => {
      const res = await setStudentLeavingDateAction(studentId, null)
      if (!res.ok) setError(res.error)
      else {
        setNotice('Leaving date cleared.')
        reset()
        router.refresh()
      }
    })
  }

  const inputCls =
    'rounded-md border border-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div>
        <Button type="button" onClick={() => (adding ? reset() : setAdding(true))}>
          {adding ? 'Cancel' : 'Add leaver'}
        </Button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Child</span>
            <select
              value={addChild}
              onChange={(e) => setAddChild(e.target.value)}
              className={inputCls}
            >
              <option value="">Select a child…</option>
              {childOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-text-muted">Leaving date</span>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <Button type="button" onClick={addLeaver} disabled={isPending}>
            Save
          </Button>
        </div>
      )}

      {leavers.length === 0 ? (
        <p className="text-sm text-text-muted">
          No children have a leaving date in the next 90 days. Add one above, or set it on a
          child&rsquo;s edit page.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Child</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Leaving</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leavers.map((l) => {
                const editing = editingId === l.studentId
                return (
                  <tr key={l.studentId}>
                    <td className="px-4 py-3 font-medium text-text-primary">{l.name}</td>
                    <td className="px-4 py-3 text-text-primary">{l.roomName}</td>
                    <td className="px-4 py-3 text-text-primary">
                      {editing ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className={inputCls}
                        />
                      ) : (
                        formatDate(l.leavingDate)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editing ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(l.studentId)}
                            disabled={isPending}
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-text-muted hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null)
                              setNotice(null)
                              setEditingId(l.studentId)
                              setEditDate(l.leavingDate)
                            }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLeaver(l.studentId, l.name)}
                            disabled={isPending}
                            className="text-xs text-text-muted hover:text-error"
                          >
                            Remove
                          </button>
                        </span>
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
