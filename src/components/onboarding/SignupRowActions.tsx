'use client'

import { useState, useTransition } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { confirmSignupAction, deleteSignupAction } from '@/lib/onboarding/ownerActions'

/** Owner controls for one portal sign-up: confirm manually + delete. */
export function SignupRowActions({ id, verified }: { id: string; verified: boolean }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await confirmSignupAction(id)
      if (res.error) setError(res.error)
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const res = await deleteSignupAction(id)
      if (res.error) {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-error">{error}</span>}

      {!verified && !confirming && (
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/10 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Confirm
        </button>
      )}

      {confirming ? (
        <span className="inline-flex items-center gap-2 text-xs">
          <span className="text-text-muted">Delete?</span>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="font-semibold text-error hover:underline disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Yes'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="font-semibold text-text-secondary hover:underline disabled:opacity-50"
          >
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-error disabled:opacity-50"
          aria-label="Delete sign-up"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      )}
    </div>
  )
}
