'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

export interface RoomRatioBand {
  label: string
  childrenPerAdult: number
  children: number
  required: number
}

export interface RoomRatio {
  id: string
  name: string
  childrenCount: number
  unknownAge: number
  requiredStaff: number
  byBand: RoomRatioBand[]
}

/**
 * Live room-ratio board. Minimum staff comes from real enrolment + ages (server);
 * staff-on-duty is entered here to check today's compliance. Not persisted — it's a
 * planning aid until a daily check-in feature records who's actually present.
 */
export function RatioBoard({ rooms }: { rooms: RoomRatio[] }) {
  const totalChildren = rooms.reduce((s, r) => s + r.childrenCount, 0)
  const totalRequired = rooms.reduce((s, r) => s + r.requiredStaff, 0)

  if (rooms.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No rooms yet. Create rooms and enrol children to see staffing ratios.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Rooms" value={rooms.length} />
        <Stat label="Children enrolled" value={totalChildren} />
        <Stat label="Minimum staff required" value={totalRequired} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
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

function RoomCard({ room }: { room: RoomRatio }) {
  const [staff, setStaff] = useState<string>(String(room.requiredStaff))
  const onDuty = Math.max(0, Number.parseInt(staff, 10) || 0)
  const shortfall = Math.max(0, room.requiredStaff - onDuty)
  const met = onDuty >= room.requiredStaff
  const empty = room.childrenCount === 0

  const status = empty
    ? { variant: 'default' as const, text: 'No children' }
    : met
      ? { variant: 'success' as const, text: 'Ratio met' }
      : { variant: 'error' as const, text: `Short ${shortfall} staff` }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">{room.name}</h2>
        <Badge variant={status.variant}>{status.text}</Badge>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {room.childrenCount} {room.childrenCount === 1 ? 'child' : 'children'} · needs{' '}
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

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor={`staff-${room.id}`} className="text-sm text-text-secondary">
          Staff on duty:
        </label>
        <input
          id={`staff-${room.id}`}
          type="number"
          min={0}
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="input-base w-20"
        />
      </div>
    </div>
  )
}
