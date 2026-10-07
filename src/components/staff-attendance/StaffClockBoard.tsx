'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { clockInAction, clockOutAction, undoClockAction } from '@/lib/staff-attendance/actions'
import type { StaffClockEntry } from '@/lib/staff-attendance/queries'
import type { ClockState } from '@/lib/staff-attendance/clocking'

const STATE_BADGE: Record<
  ClockState,
  { variant: 'success' | 'default' | 'warning'; text: string }
> = {
  in: { variant: 'success', text: 'On duty' },
  out: { variant: 'default', text: 'Clocked out' },
  not_in: { variant: 'warning', text: 'Not in' },
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Dublin',
  })
}

export function StaffClockBoard({
  staff,
  dateLabel,
}: {
  staff: StaffClockEntry[]
  dateLabel: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onDuty = staff.filter((s) => s.state === 'in').length

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No active staff yet. Add staff first.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-text-muted">On duty now · {dateLabel}</p>
        <p className="mt-1 text-2xl font-bold text-text-primary">
          {onDuty} <span className="text-base font-normal text-text-muted">of {staff.length}</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <ul className="divide-y divide-border/60">
          {staff.map((s) => {
            const badge = STATE_BADGE[s.state]
            const inT = fmtTime(s.clockInAt)
            const outT = fmtTime(s.clockOutAt)
            return (
              <li key={s.teacherId} className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm">
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                    {s.name}
                  </span>
                  {(inT || outT) && (
                    <span className="pl-0.5 text-xs text-text-muted">
                      {inT && <>In {inT}</>}
                      {outT && <> · Out {outT}</>}
                    </span>
                  )}
                </span>
                <span className="flex gap-1.5">
                  {s.state === 'not_in' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => run(() => clockInAction(s.teacherId))}
                      disabled={isPending}
                    >
                      Clock in
                    </Button>
                  )}
                  {s.state === 'in' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => run(() => clockOutAction(s.teacherId))}
                        disabled={isPending}
                      >
                        Clock out
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => undoClockAction(s.teacherId))}
                        disabled={isPending}
                        title="Undo today's clock-in"
                      >
                        Undo
                      </Button>
                    </>
                  )}
                  {s.state === 'out' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => undoClockAction(s.teacherId))}
                      disabled={isPending}
                      title="Undo today's clock record"
                    >
                      Undo
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
