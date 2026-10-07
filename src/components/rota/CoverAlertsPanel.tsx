import { Badge } from '@/components/ui/Badge'
import type { CoverWeek } from '@/lib/rota/cover-queries'

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/**
 * Read-only planned cover alerts for the rota week: rooms rostered below their
 * required ratio staffing, grouped by day. Shown above the rota so gaps are visible
 * while planning.
 */
export function CoverAlertsPanel({ cover }: { cover: CoverWeek }) {
  if (cover.roomsTracked === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
        Cover alerts appear here once rooms have children with dates of birth (to compute the
        required ratio) and staff are rostered.
      </div>
    )
  }

  if (cover.totalAlerts === 0) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <Badge variant="success">Covered</Badge>
          Every room meets its required ratio staffing on the rota this week.
        </p>
      </div>
    )
  }

  const daysWithAlerts = cover.days.filter((d) => d.alerts.length > 0)

  return (
    <div className="rounded-xl border border-error/40 bg-error/5 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-text-primary">
        <Badge variant="error">Cover needed</Badge>
        {cover.totalAlerts} room-day{cover.totalAlerts === 1 ? '' : 's'} under the required ratio
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Rooms rostered below the staff required for their children&apos;s ages. Add shifts to cover
        them.
      </p>
      <div className="mt-3 space-y-3">
        {daysWithAlerts.map((d) => (
          <div key={d.date}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {dayLabel(d.date)}
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {d.alerts.map((a) => (
                <li key={a.roomId} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-primary">{a.roomName}</span>
                  <span className="text-text-secondary">
                    {a.rosteredStaff} of {a.requiredStaff} staff
                  </span>
                  <Badge variant="error">needs {a.shortfall} more</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
