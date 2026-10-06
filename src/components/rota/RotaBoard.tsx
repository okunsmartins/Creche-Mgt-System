'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createShiftAction, deleteShiftAction } from '@/lib/rota/actions'
import { formatHours } from '@/lib/rota/rota'
import type { RotaWeek } from '@/lib/rota/queries'

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function hhmm(t: string): string {
  return t.slice(0, 5)
}

export function RotaBoard({
  week,
  prevWeek,
  nextWeek,
}: {
  week: RotaWeek
  prevWeek: string
  nextWeek: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [classId, setClassId] = useState('')
  const [shiftDate, setShiftDate] = useState(week.days[0]?.date ?? week.weekStart)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [label, setLabel] = useState('')

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        after?.()
        router.refresh()
      }
    })
  }

  function addShift() {
    const payload: Parameters<typeof createShiftAction>[0] = {
      teacherId,
      classId: classId || null,
      shiftDate,
      startTime,
      endTime,
    }
    if (label.trim()) payload.label = label.trim()
    run(
      () => createShiftAction(payload),
      () => setLabel(''),
    )
  }

  const weekEndLabel = dayLabel(week.days[6]?.date ?? week.weekStart)

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/admin/rota?week=${prevWeek}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          ← Previous week
        </a>
        <span className="text-sm font-medium text-text-secondary">
          {dayLabel(week.weekStart)} – {weekEndLabel}
        </span>
        <a
          href={`/admin/rota?week=${nextWeek}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          Next week →
        </a>
      </div>

      {/* Add shift */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-text-primary">Add a shift</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block text-sm lg:col-span-2">
            <span className="text-text-secondary">Staff</span>
            <select
              className="input-base mt-1"
              value={teacherId}
              disabled={isPending}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Select…</option>
              {week.staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Room</span>
            <select
              className="input-base mt-1"
              value={classId}
              disabled={isPending}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Any / none</option>
              {week.roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Day</span>
            <select
              className="input-base mt-1"
              value={shiftDate}
              disabled={isPending}
              onChange={(e) => setShiftDate(e.target.value)}
            >
              {week.days.map((d) => (
                <option key={d.date} value={d.date}>
                  {dayLabel(d.date)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Start</span>
            <input
              type="time"
              className="input-base mt-1"
              value={startTime}
              disabled={isPending}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">End</span>
            <input
              type="time"
              className="input-base mt-1"
              value={endTime}
              disabled={isPending}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-5">
            <span className="text-text-secondary">Label (optional)</span>
            <input
              type="text"
              className="input-base mt-1"
              placeholder="e.g. Early, Lunch cover"
              value={label}
              disabled={isPending}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <Button type="button" loading={isPending} disabled={!teacherId} onClick={addShift}>
              Add shift
            </Button>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="grid gap-3 lg:grid-cols-2">
        {week.days.map((d) => {
          const dayMinutes = d.shifts.reduce((n, s) => n + s.minutes, 0)
          return (
            <div key={d.date} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-text-primary">{dayLabel(d.date)}</h3>
                <span className="text-xs text-text-muted">
                  {d.shifts.length === 0 ? 'No shifts' : formatHours(dayMinutes)}
                </span>
              </div>
              {d.shifts.length > 0 && (
                <ul className="mt-2 divide-y divide-border/60">
                  {d.shifts.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <span className="font-medium text-text-primary">{s.teacherName}</span>{' '}
                        <span className="text-text-secondary">
                          {hhmm(s.startTime)}–{hhmm(s.endTime)}
                        </span>{' '}
                        <span className="text-text-muted">
                          {s.roomName ? `· ${s.roomName}` : ''}
                          {s.label ? ` · ${s.label}` : ''} · {formatHours(s.minutes)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => run(() => deleteShiftAction(s.id))}
                        disabled={isPending}
                        className="text-xs font-medium text-error hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {/* Weekly totals per staff */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold text-text-primary">Weekly hours by staff</h2>
        {week.staffTotals.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">No shifts rostered this week yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {week.staffTotals.map((t) => (
              <li key={t.teacherId} className="flex justify-between py-2 text-sm">
                <span className="text-text-primary">{t.name}</span>
                <span className="font-medium text-text-secondary">{formatHours(t.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
