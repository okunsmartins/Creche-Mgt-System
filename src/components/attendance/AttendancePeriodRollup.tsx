import Link from 'next/link'
import type { Granularity, PeriodSummary } from '@/lib/attendance/summary'

interface Props {
  periods: PeriodSummary[]
  granularity: Granularity
  /** Route the toggle links to, e.g. /teacher/attendance/summary */
  basePath: string
  /** Query params to preserve across the toggle (from, to, and classId for admin). */
  params: Record<string, string>
}

function barColour(rate: number | null): string {
  if (rate === null) return 'bg-border'
  if (rate >= 95) return 'bg-emerald-500/70'
  if (rate >= 85) return 'bg-amber-500/70'
  return 'bg-red-500/70'
}

function rateText(rate: number | null): string {
  if (rate === null) return 'text-text-muted'
  if (rate >= 95) return 'text-emerald-400'
  if (rate >= 85) return 'text-amber-400'
  return 'text-red-400'
}

function buildHref(basePath: string, params: Record<string, string>): string {
  return `${basePath}?${new URLSearchParams(params).toString()}`
}

export function AttendancePeriodRollup({ periods, granularity, basePath, params }: Props) {
  const toggles: { value: Granularity; label: string }[] = [
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
          Attendance over time
        </h2>
        {/* Granularity toggle */}
        <div className="inline-flex rounded-lg bg-surface-raised p-0.5 ring-1 ring-border">
          {toggles.map((t) => {
            const active = granularity === t.value
            return (
              <Link
                key={t.value}
                href={buildHref(basePath, { ...params, g: t.value })}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  active ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>

      {periods.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-text-muted">No sessions to chart in this period.</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="card p-5">
            <div className="flex h-44 items-stretch gap-2 overflow-x-auto">
              {periods.map((p) => (
                <div
                  key={p.key}
                  className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center gap-1.5"
                >
                  <span
                    className={`text-xs font-semibold tabular-nums ${rateText(p.attendanceRate)}`}
                  >
                    {p.attendanceRate === null ? '—' : `${p.attendanceRate}%`}
                  </span>
                  {/* Track: definite-height (flex-1 in a full-height column) so the
                      absolutely-positioned bar's % height resolves reliably. */}
                  <div className="relative w-full flex-1">
                    <div
                      className={`absolute bottom-0 left-0 w-full rounded-t ${barColour(p.attendanceRate)}`}
                      style={{ height: `${p.attendanceRate ?? 0}%` }}
                      title={`${p.label}: ${p.attendanceRate ?? 0}%`}
                    />
                  </div>
                  <span className="line-clamp-2 text-center text-[10px] leading-tight text-text-muted">
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Period table */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-text-muted">
                    {granularity === 'week' ? 'Week' : 'Month'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Sessions
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Present
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-amber-400">
                    Late
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-red-400">
                    Absent
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr
                    key={p.key}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">{p.label}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-text-secondary">
                      {p.sessionCount}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-400">
                      {p.present}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-amber-400">{p.late}</td>
                    <td className="px-4 py-3 text-center font-semibold text-red-400">{p.absent}</td>
                    <td
                      className={`px-4 py-3 text-right font-bold tabular-nums ${rateText(p.attendanceRate)}`}
                    >
                      {p.attendanceRate === null ? '—' : `${p.attendanceRate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-text-muted">
            Each bar is the class attendance rate for that{' '}
            {granularity === 'week' ? 'week' : 'month'} (late counts as present). Periods at the
            edges of the date range may be partial.
          </p>
        </>
      )}
    </section>
  )
}
