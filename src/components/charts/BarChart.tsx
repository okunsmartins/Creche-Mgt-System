import { chartColor } from './chartColors'

export interface BarDatum {
  label: string
  value: number
}

interface BarChartProps {
  title: string
  data: BarDatum[]
  /** Formats the value shown in the hover tooltip (e.g. currency). */
  formatValue?: (value: number) => string
  /** Optional element rendered on the right of the header (e.g. a period chip). */
  action?: React.ReactNode
}

/**
 * Self-contained bar chart — rounded pastel bars with faint gridlines and
 * x-axis labels. Pure CSS/SVG, server-renderable (no client hooks).
 */
export function BarChart({ title, data, formatValue = (v) => String(v), action }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="card p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {action}
      </div>

      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">No data yet.</p>
      ) : (
        <>
          <div className="relative" style={{ height: 168 }}>
            {/* Gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-t border-border/60" />
              ))}
            </div>
            {/* Bars */}
            <div className="relative flex h-full items-end gap-2 sm:gap-3">
              {data.map((d, i) => {
                const pct = (d.value / max) * 100
                return (
                  <div key={`${d.label}-${i}`} className="flex h-full flex-1 flex-col justify-end">
                    <div
                      className="w-full rounded-lg transition-all"
                      style={{
                        height: `${d.value === 0 ? 1.5 : Math.max(pct, 4)}%`,
                        background: chartColor(i),
                      }}
                      title={`${d.label}: ${formatValue(d.value)}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-2 flex gap-2 sm:gap-3">
            {data.map((d, i) => (
              <span
                key={`${d.label}-${i}`}
                className="flex-1 truncate text-center text-[10px] text-text-muted"
              >
                {d.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
