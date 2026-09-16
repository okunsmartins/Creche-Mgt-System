'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react'
import { markAttendanceAction, type MarkAttendanceState } from '@/lib/attendance/actions'

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface AttendanceFormProps {
  classId: string
  className: string
  students: Student[]
  defaultDate: string
  existingRecords?: { studentId: string; status: 'present' | 'absent' | 'late'; note?: string }[]
  existingSessionNotes?: string
}

type Status = 'present' | 'absent' | 'late'

const STATUS_CONFIG: Record<
  Status,
  { label: string; icon: typeof CheckCircle2; classes: string; ring: string }
> = {
  present: {
    label: 'Present',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
    ring: 'ring-emerald-500',
  },
  late: {
    label: 'Late',
    icon: Clock,
    classes: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
    ring: 'ring-amber-500',
  },
  absent: {
    label: 'Absent',
    icon: XCircle,
    classes: 'bg-red-500/20 text-red-300 ring-red-500/40',
    ring: 'ring-red-500',
  },
}

export function AttendanceForm({
  classId,
  className: _className,
  students,
  defaultDate,
  existingRecords = [],
  existingSessionNotes,
}: AttendanceFormProps) {
  const initialStatuses = Object.fromEntries(
    students.map((s) => {
      const existing = existingRecords.find((r) => r.studentId === s.id)
      return [s.id, existing?.status ?? 'present'] as [string, Status]
    }),
  )
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatuses)
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(
      existingRecords.filter((r) => r.note).map((r) => [r.studentId, r.note ?? '']),
    ),
  )
  const [sessionDate, setSessionDate] = useState(defaultDate)
  const [sessionNotes, setSessionNotes] = useState(existingSessionNotes ?? '')

  const [state, formAction, pending] = useActionState<MarkAttendanceState, FormData>(
    markAttendanceAction,
    null,
  )

  const counts = { present: 0, late: 0, absent: 0 }
  Object.values(statuses).forEach((s) => {
    counts[s]++
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const records = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] ?? 'present',
      note: notes[s.id] ?? undefined,
    }))
    const recordsInput = form.querySelector<HTMLInputElement>('input[name="records"]')
    if (recordsInput) recordsInput.value = JSON.stringify(records)
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="records" value="" />

      {/* Date + session notes */}
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
              Session date
            </label>
            <input
              type="date"
              name="sessionDate"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
              Session notes (optional)
            </label>
            <input
              type="text"
              name="notes"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. Fire drill at 10am"
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Summary counts */}
        <div className="flex flex-wrap gap-3">
          {(Object.entries(counts) as [Status, number][]).map(([s, n]) => {
            const cfg = STATUS_CONFIG[s]
            const Icon = cfg.icon
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold ring-1 ${cfg.classes}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n} {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {students.map((student) => {
          const status: Status = statuses[student.id] ?? 'present'
          const cfg = STATUS_CONFIG[status]
          return (
            <div key={student.id} className="card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-text-primary">
                  {student.first_name} {student.last_name}
                </p>
                {/* Status toggles */}
                <div className="flex gap-2">
                  {(
                    Object.entries(STATUS_CONFIG) as [Status, (typeof STATUS_CONFIG)[Status]][]
                  ).map(([s, c]) => {
                    const Icon = c.icon
                    const active = status === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatuses((prev) => ({ ...prev, [student.id]: s }))}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                          active
                            ? cfg.classes
                            : 'bg-surface-raised text-text-muted ring-border hover:text-text-primary'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Note field — shown when late or absent */}
              {(status === 'late' || status === 'absent') && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={notes[student.id] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))
                    }
                    maxLength={255}
                    placeholder={
                      status === 'late' ? 'Reason for late arrival…' : 'Reason for absence…'
                    }
                    className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {state?.error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save attendance'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
