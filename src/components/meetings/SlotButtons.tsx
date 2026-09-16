'use client'

import { useState, useTransition } from 'react'
import { Trash2, CalendarCheck, CalendarX } from 'lucide-react'
import { deleteSlotAction, bookSlotAction, cancelBookingAction } from '@/lib/meetings/actions'

/** Teacher: remove an unbooked slot. */
export function DeleteSlotButton({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await deleteSlotAction(slotId)
            if (result && 'error' in result) setError(result.error)
          })
        }}
        disabled={pending}
        aria-label="Remove slot"
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  )
}

/** Parent: book a free slot for a specific child. */
export function BookSlotButton({ slotId, studentId }: { slotId: string; studentId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await bookSlotAction(slotId, studentId)
            if (result && 'error' in result) setError(result.error)
          })
        }}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? 'Booking…' : 'Book'}
      </button>
      {error && <span className="max-w-48 text-right text-xs text-error">{error}</span>}
    </span>
  )
}

/** Parent: cancel their own future booking. */
export function CancelBookingButton({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await cancelBookingAction(slotId)
            if (result && 'error' in result) setError(result.error)
          })
        }}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? 'Cancelling…' : 'Cancel'}
      </button>
      {error && <span className="max-w-48 text-right text-xs text-error">{error}</span>}
    </span>
  )
}
