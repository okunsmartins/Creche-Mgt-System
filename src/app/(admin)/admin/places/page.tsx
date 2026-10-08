import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getPlacesOverview } from '@/lib/places/queries'
import { PlacesRoomsTable } from '@/components/places/PlacesRoomsTable'
import { UpcomingLeaversPanel } from '@/components/places/UpcomingLeaversPanel'

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

export default async function PlacesPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const today = todayISO()
  const [{ rooms, leavers, totalCapacity, totalEnrolled, totalAvailable }, { data: childData }] =
    await Promise.all([
      getPlacesOverview(admin.schoolId, today),
      db
        .from('students')
        .select('id, first_name, last_name')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true)
        .order('last_name'),
    ])

  const children = (
    (childData ?? []) as { id: string; first_name: string; last_name: string }[]
  ).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Places &amp; vacancies</h1>
        <p className="mt-1 text-sm text-text-muted">
          Available places per room and children due to leave in the next 90 days. Edit a
          room&rsquo;s capacity or a child&rsquo;s leaving date right here.
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

      {/* Per-room table (capacity editable inline) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          By room
        </h2>
        <PlacesRoomsTable rooms={rooms} />
        <p className="mt-2 text-xs text-text-muted">
          Set a room&rsquo;s capacity here (or on its edit page under Rooms) to track available
          places.
        </p>
      </div>

      {/* Upcoming leavers (add / edit / remove) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Upcoming leavers (next 90 days)
        </h2>
        <UpcomingLeaversPanel leavers={leavers} childOptions={children} />
      </div>
    </div>
  )
}
