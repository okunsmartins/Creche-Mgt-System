'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { saveRatioBandsAction, setStaffOnDutyAction } from '@/lib/ratios/actions'
import type { EyRatioBand } from '@/lib/ratios/ratio'

export interface RoomRatioBand {
  label: string
  childrenPerAdult: number
  children: number
  required: number
}

export interface RoomRatio {
  id: string
  name: string
  childrenCount: number // present now
  enrolledCount: number
  unknownAge: number
  requiredStaff: number
  byBand: RoomRatioBand[]
  /** Saved staff-on-duty for today, or null if none saved. */
  savedStaff: number | null
}

export function RatioBoard({
  rooms,
  bands,
  today,
}: {
  rooms: RoomRatio[]
  bands: EyRatioBand[]
  today: string
}) {
  const totalPresent = rooms.reduce((s, r) => s + r.childrenCount, 0)
  const totalRequired = rooms.reduce((s, r) => s + r.requiredStaff, 0)

  return (
    <div className="space-y-5">
      <RatioConfigPanel bands={bands} />

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No rooms yet. Create rooms and enrol children to see staffing ratios.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Rooms" value={rooms.length} />
            <Stat label="Children present now" value={totalPresent} />
            <Stat label="Minimum staff required" value={totalRequired} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} today={today} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

function RatioConfigPanel({ bands }: { bands: EyRatioBand[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<string[]>(bands.map((b) => String(b.childrenPerAdult)))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function save() {
    setError(null)
    setNotice(null)
    const next: EyRatioBand[] = bands.map((b, i) => ({
      ...b,
      childrenPerAdult: Math.floor(Number.parseInt(values[i] ?? '', 10)),
    }))
    for (const b of next) {
      if (!Number.isInteger(b.childrenPerAdult) || b.childrenPerAdult < 1) {
        setError(`"${b.label}" needs a children-per-adult of 1 or more.`)
        return
      }
    }
    startTransition(async () => {
      const res = await saveRatioBandsAction(next)
      if (!res.ok) setError(res.error ?? 'Could not save.')
      else {
        setNotice('Ratio configuration saved.')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text-primary">
        Allowed ratios (children per adult)
      </h2>
      <p className="mt-0.5 text-xs text-text-muted">
        Your crèche&apos;s adult:child ratio for each age band. Defaults to the Irish reference
        ratios — adjust to your policy. Used across ratios, rota cover and the dashboard alert.
      </p>
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" className="mt-3">
          {notice}
        </Alert>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-4">
        {bands.map((b, i) => (
          <label key={b.label} className="block text-xs">
            <span className="text-text-secondary">{b.label}</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-text-muted">1:</span>
              <input
                type="number"
                min={1}
                className="input-base w-20"
                value={values[i] ?? ''}
                disabled={isPending}
                onChange={(e) =>
                  setValues((v) => v.map((x, idx) => (idx === i ? e.target.value : x)))
                }
              />
            </div>
          </label>
        ))}
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Save ratios
        </button>
      </div>
    </div>
  )
}

function RoomCard({ room, today }: { room: RoomRatio; today: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [staff, setStaff] = useState<string>(room.savedStaff != null ? String(room.savedStaff) : '')
  const [error, setError] = useState<string | null>(null)

  const onDuty = Math.max(0, Number.parseInt(staff, 10) || 0)
  const entered = staff.trim() !== ''
  const shortfall = Math.max(0, room.requiredStaff - onDuty)
  const met = onDuty >= room.requiredStaff
  const empty = room.childrenCount === 0
  const dirty = staff.trim() !== (room.savedStaff != null ? String(room.savedStaff) : '')

  const status = empty
    ? { variant: 'default' as const, text: 'None present' }
    : !entered
      ? { variant: 'default' as const, text: `Needs ${room.requiredStaff}` }
      : met
        ? { variant: 'success' as const, text: 'Ratio met' }
        : { variant: 'error' as const, text: `Short ${shortfall} staff` }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await setStaffOnDutyAction({ classId: room.id, date: today, count: onDuty })
      if (!res.ok) setError(res.error ?? 'Could not save.')
      else router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">{room.name}</h2>
        <Badge variant={status.variant}>{status.text}</Badge>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {room.childrenCount} present of {room.enrolledCount} enrolled · needs{' '}
        <strong>{room.requiredStaff}</strong> staff minimum
      </p>

      {room.byBand.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {room.byBand.map((b) => (
            <li key={b.label} className="flex justify-between text-text-secondary">
              <span>
                {b.label} <span className="text-text-muted">(1:{b.childrenPerAdult})</span>
              </span>
              <span>
                {b.children} → {b.required} staff
              </span>
            </li>
          ))}
        </ul>
      )}

      {room.unknownAge > 0 && (
        <p className="mt-2 text-xs text-warning">
          {room.unknownAge} child{room.unknownAge === 1 ? '' : 'ren'} without a valid date of birth
          — add DOBs to include them in the ratio.
        </p>
      )}

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor={`staff-${room.id}`} className="text-sm text-text-secondary">
          Staff on duty:
        </label>
        <input
          id={`staff-${room.id}`}
          type="number"
          min={0}
          value={staff}
          disabled={isPending}
          onChange={(e) => setStaff(e.target.value)}
          className="input-base w-20"
        />
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            Save
          </button>
        )}
        {room.savedStaff != null && !dirty && (
          <span className="text-xs text-text-muted">saved</span>
        )}
      </div>
    </div>
  )
}
