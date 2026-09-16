import Link from 'next/link'
import { getWeekRange, getMonthRange } from '@/lib/attendance/summary'

interface Props {
  /** Route the filter submits to, e.g. /teacher/attendance/summary */
  basePath: string
  from: string
  to: string
  /** Extra query params to preserve across preset links (e.g. classId for admin). */
  extraParams?: Record<string, string>
}

function buildHref(basePath: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return `${basePath}?${qs}`
}

export function AttendanceRangeFilter({ basePath, from, to, extraParams = {} }: Props) {
  const week = getWeekRange()
  const month = getMonthRange()

  const presets = [
    { label: 'This week', range: week },
    { label: 'This month', range: month },
  ]

  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active = from === p.range.from && to === p.range.to
          return (
            <Link
              key={p.label}
              href={buildHref(basePath, { ...extraParams, from: p.range.from, to: p.range.to })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                active
                  ? 'bg-primary/15 text-primary ring-primary/40'
                  : 'bg-surface-raised text-text-muted ring-border hover:text-text-primary'
              }`}
            >
              {p.label}
            </Link>
          )
        })}
      </div>

      {/* Custom range (native GET form) */}
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {Object.entries(extraParams).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            From
          </label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            To
          </label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
        >
          Apply
        </button>
      </form>
    </div>
  )
}
