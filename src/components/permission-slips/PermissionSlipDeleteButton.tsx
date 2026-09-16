'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deletePermissionSlipAction } from '@/lib/permission-slips/actions'

/** Two-click delete for a permission slip (removes its responses too). */
export function PermissionSlipDeleteButton({ slipId }: { slipId: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function remove() {
    setError(null)
    startTransition(async () => {
      const res = await deletePermissionSlipAction(slipId)
      if (res.error) {
        setError(res.error)
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-text-muted">Delete slip &amp; responses?</span>
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
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-error">{error}</span>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-error"
        aria-label="Delete permission slip"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete
      </button>
    </span>
  )
}
