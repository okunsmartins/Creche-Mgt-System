'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { updateRoomCapacityAction } from '@/lib/places/actions'

export interface RoomRow {
  id: string
  name: string
  capacity: number | null
  enrolled: number
  available: number | null
}

export function PlacesRoomsTable({ rooms }: { rooms: RoomRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function startEdit(room: RoomRow) {
    setError(null)
    setEditingId(room.id)
    setDraft(room.capacity == null ? '' : String(room.capacity))
  }

  function save(roomId: string) {
    setError(null)
    const trimmed = draft.trim()
    let capacity: number | null = null
    if (trimmed !== '') {
      const n = Number(trimmed)
      if (!Number.isInteger(n) || n < 0) {
        setError('Capacity must be a whole number of 0 or more.')
        return
      }
      capacity = n
    }
    startTransition(async () => {
      const res = await updateRoomCapacityAction(roomId, capacity)
      if (!res.ok) setError(res.error)
      else {
        setEditingId(null)
        router.refresh()
      }
    })
  }

  if (rooms.length === 0) return <p className="text-sm text-text-muted">No rooms yet.</p>

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 text-right font-medium">Capacity</th>
              <th className="px-4 py-3 text-right font-medium">Enrolled</th>
              <th className="px-4 py-3 text-right font-medium">Available</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rooms.map((r) => {
              const over = r.capacity != null && r.enrolled > r.capacity
              const editing = editingId === r.id
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-text-primary">{r.name}</td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draft}
                        autoFocus
                        placeholder="—"
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      (r.capacity ?? <span className="text-text-muted">—</span>)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">{r.enrolled}</td>
                  <td className="px-4 py-3 text-right">
                    {r.available == null ? (
                      <span className="text-text-muted">—</span>
                    ) : over ? (
                      <span className="font-semibold text-error">
                        Over by {r.enrolled - r.capacity!}
                      </span>
                    ) : r.available === 0 ? (
                      <span className="font-semibold text-text-muted">Full</span>
                    ) : (
                      <span className="font-semibold text-primary">{r.available}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      <span className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => save(r.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs text-text-muted hover:underline"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {r.capacity == null ? 'Set capacity' : 'Edit'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
