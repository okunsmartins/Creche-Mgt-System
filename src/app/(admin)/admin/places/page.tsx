import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getPlacesOverview } from '@/lib/places/queries'

export const metadata: Metadata = { title: 'Places & Vacancies' }

function todayISO(): string {
  // Wall-clock "today" in Europe/Dublin (crèche-local), formatted YYYY-MM-DD.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

export default async function PlacesPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const today = todayISO()
  const { rooms, leavers, totalCapacity, totalEnrolled, totalAvailable } = await getPlacesOverview(
    admin.schoolId,
    today,
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Places &amp; vacancies</h1>
        <p className="mt-1 text-sm text-text-muted">
          Available places per room and children due to leave in the next 90 days.
        </p>
      </div>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Capacity</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{totalCapacity}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Enrolled</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{totalEnrolled}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Available places
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{totalAvailable}</p>
        </div>
      </div>

      {/* Per-room table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          By room
        </h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-text-muted">No rooms yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 text-right font-medium">Capacity</th>
                  <th className="px-4 py-3 text-right font-medium">Enrolled</th>
                  <th className="px-4 py-3 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rooms.map((r) => {
                  const over = r.capacity != null && r.enrolled > r.capacity
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-text-primary">{r.name}</td>
                      <td className="px-4 py-3 text-right text-text-primary">
                        {r.capacity ?? <span className="text-text-muted">—</span>}
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">
          Set a room&rsquo;s capacity on its edit page (Rooms → a room) to track available places.
        </p>
      </div>

      {/* Upcoming leavers */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Upcoming leavers (next 90 days)
        </h2>
        {leavers.length === 0 ? (
          <p className="text-sm text-text-muted">
            No children have a leaving date in the next 90 days. Set a child&rsquo;s expected
            leaving date on their edit page.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Child</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Leaving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leavers.map((l) => (
                  <tr key={l.studentId}>
                    <td className="px-4 py-3 font-medium text-text-primary">{l.name}</td>
                    <td className="px-4 py-3 text-text-primary">{l.roomName}</td>
                    <td className="px-4 py-3 text-text-primary">{formatDate(l.leavingDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
