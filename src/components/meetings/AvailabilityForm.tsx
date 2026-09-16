'use client'

import { useActionState } from 'react'
import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { createAvailabilityAction } from '@/lib/meetings/actions'
import type { MeetingActionState } from '@/lib/meetings/schemas'
import { SLOT_DURATIONS_MINS } from '@/lib/meetings/slots'

export interface TeacherClassOption {
  id: string
  name: string
}

export function AvailabilityForm({ classes = [] }: { classes?: TeacherClassOption[] }) {
  const [state, formAction, pending] = useActionState<MeetingActionState, FormData>(
    createAvailabilityAction,
    null,
  )

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {state && 'error' in state && (
        <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {state.error}
        </div>
      )}
      {state && 'success' in state && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {state.created && state.created > 0
              ? `${state.created} slot${state.created === 1 ? '' : 's'} published.`
              : 'That window is already covered by your existing slots — nothing new to publish.'}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="slotDate"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            Date
          </label>
          <input
            id="slotDate"
            name="slotDate"
            type="date"
            required
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label
            htmlFor="durationMins"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            Slot length
          </label>
          <select
            id="durationMins"
            name="durationMins"
            defaultValue="15"
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SLOT_DURATIONS_MINS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="startTime"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            From
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label
            htmlFor="endTime"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            Until
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {classes.length >= 2 && (
        <div>
          <label
            htmlFor="classId"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            For class
          </label>
          <select
            id="classId"
            name="classId"
            defaultValue=""
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All my classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} only
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-muted">
            Choosing a class means only that class&apos;s parents can book these slots.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {pending ? 'Publishing…' : 'Publish slots'}
      </button>
      <p className="text-xs text-text-muted">
        The window is split into equal slots parents can book. Publishing an overlapping window
        again only adds the missing slots.
      </p>
    </form>
  )
}
