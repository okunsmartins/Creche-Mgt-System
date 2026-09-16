'use client'

import { useState, useTransition } from 'react'
import { Power, RotateCcw, Trash2, X } from 'lucide-react'
import { deleteSchoolAction, setSchoolActiveAction } from '@/lib/platform/schoolActions'

interface SchoolRowActionsProps {
  schoolId: string
  name: string
  isActive: boolean
}

/**
 * Owner controls for one school row. Active schools can be deactivated (soft,
 * reversible); deactivated schools can be reactivated or — behind a type-the-name
 * confirmation — permanently deleted. Both guards are re-checked server-side.
 */
export function SchoolRowActions({ schoolId, name, isActive }: SchoolRowActionsProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')

  const typedMatches =
    name.trim().length > 0 && typed.trim().toLowerCase() === name.trim().toLowerCase()

  function toggleActive(next: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await setSchoolActiveAction(schoolId, next)
      if (res.error) setError(res.error)
    })
  }

  function openConfirm() {
    setError(null)
    setTyped('')
    setConfirmOpen(true)
  }

  function closeConfirm() {
    setError(null)
    setConfirmOpen(false)
  }

  function confirmDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteSchoolAction(schoolId, typed)
      if (res.error) setError(res.error)
      else setConfirmOpen(false)
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {!confirmOpen && error && <span className="text-xs text-error">{error}</span>}

      {isActive ? (
        <button
          type="button"
          onClick={() => toggleActive(false)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-text-secondary ring-1 ring-border hover:bg-surface-raised disabled:opacity-50"
        >
          <Power className="h-3.5 w-3.5" aria-hidden="true" />
          Deactivate
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => toggleActive(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/10 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reactivate
          </button>
          <button
            type="button"
            onClick={openConfirm}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-error ring-1 ring-error/30 hover:bg-error/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        </>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Permanently delete ${name}`}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-left shadow-card-hover">
            <div className="mb-2 flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-text-primary">Permanently delete “{name}”?</h2>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={pending}
                className="text-text-muted hover:text-text-primary disabled:opacity-50"
                aria-label="Cancel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-text-secondary">
              This deletes the school and <strong>all of its data</strong> — students, classes,
              orders, payments and subscriptions. This <strong>cannot be undone</strong>.
            </p>
            <label htmlFor={`confirm-${schoolId}`} className="mt-4 block text-xs text-text-muted">
              Type <span className="font-semibold text-text-primary">{name}</span> to confirm
            </label>
            <input
              id={`confirm-${schoolId}`}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            {error && <p className="mt-2 text-xs text-error">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary ring-1 ring-border hover:bg-surface-raised disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending || !typedMatches}
                className="inline-flex items-center gap-1.5 rounded-lg bg-error px-3 py-2 text-sm font-semibold text-error-foreground hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {pending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
