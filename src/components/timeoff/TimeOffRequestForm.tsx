'use client'

import { useActionState } from 'react'
import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { createTimeOffRequestAction } from '@/lib/timeoff/actions'
import type { TimeOffActionState } from '@/lib/timeoff/schemas'

export function TimeOffRequestForm() {
  const [state, formAction, pending] = useActionState<TimeOffActionState, FormData>(
    createTimeOffRequestAction,
    null,
  )

  if (state && 'success' in state) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-text-primary">Request submitted</p>
          <p className="mt-1 text-sm text-text-muted">
            Your administrator will review it. You can track its status below.
          </p>
          <a
            href=""
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Submit another
          </a>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {state && 'error' in state && (
        <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="startDate"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="reason"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Reason (optional)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="e.g. Medical appointment"
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {pending ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  )
}
