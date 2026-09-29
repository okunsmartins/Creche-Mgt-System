'use client'

import { useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { reviewTimeOffRequestAction } from '@/lib/timeoff/actions'

export function TimeOffReviewButtons({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  function submit(decision: 'approved' | 'rejected', reviewNote?: string) {
    setError(null)
    startTransition(async () => {
      const result = await reviewTimeOffRequestAction(requestId, decision, reviewNote)
      if (result && 'error' in result) setError(result.error)
    })
  }

  if (rejecting) {
    return (
      <div className="w-full max-w-xs space-y-2 sm:w-64">
        <label
          htmlFor={`note-${requestId}`}
          className="block text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Note to teacher (optional)
        </label>
        <textarea
          id={`note-${requestId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. Dates clash with the crèche tour"
          autoFocus
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setRejecting(false)
              setNote('')
              setError(null)
            }}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit('rejected', note)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {pending ? 'Rejecting…' : 'Confirm reject'}
          </button>
        </div>
        {error && <p className="text-right text-xs text-error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit('approved')}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
