'use client'

import { useState, useTransition } from 'react'
import { MessageSquarePlus, Pencil } from 'lucide-react'
import { submitAbsenceReasonAction } from '@/lib/attendance/parentActions'

interface AbsenceReasonFormProps {
  recordId: string
  initialReason: string | null
}

/** Inline add/edit of the parent's reason for one absence or late mark. */
export function AbsenceReasonForm({ recordId, initialReason }: AbsenceReasonFormProps) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState((initialReason ?? '').trim())
  const [value, setValue] = useState(saved)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await submitAbsenceReasonAction(recordId, value)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(value.trim())
        setEditing(false)
      }
    })
  }

  function startEdit() {
    setError(null)
    setValue(saved)
    setEditing(true)
  }

  if (!editing) {
    return saved ? (
      <div className="mt-1.5 flex items-start gap-2 text-sm">
        <span className="text-text-secondary">
          <span className="font-medium text-text-primary">Your reason:</span> {saved}
        </span>
        <button
          type="button"
          onClick={startEdit}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Edit
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={startEdit}
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
        Add a reason
      </button>
    )
  }

  return (
    <div className="mt-1.5 space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={500}
        autoFocus
        aria-label="Reason for this absence or late mark"
        placeholder="e.g. Off sick with a cold"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(saved)
            setEditing(false)
            setError(null)
          }}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary ring-1 ring-border hover:bg-surface-raised disabled:opacity-50"
        >
          Cancel
        </button>
        {saved && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              startTransition(async () => {
                const res = await submitAbsenceReasonAction(recordId, '')
                if (res.error) setError(res.error)
                else {
                  setSaved('')
                  setEditing(false)
                }
              })
            }}
            disabled={pending}
            className="ml-auto text-xs font-medium text-error hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
