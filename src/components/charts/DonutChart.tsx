import { chartColor } from './chartColors'

export interface DonutDatum {
  label: string
  value: number
}

interface DonutChartProps {
  title: string
  data: DonutDatum[]
}

/**
 * Self-contained donut chart with a legend showing each slice's percentage.
 * Pure SVG, server-renderable (no client hooks).
 */
export function DonutChart({ title, data }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const R = 55
  const C = 2 * Math.PI * R

  let acc = 0
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0
    const dash = frac * C
    const seg = {
      label: d.label,
      value: d.value,
      color: chartColor(i),
      dash,
      offset: acc,
      pct: Math.round(frac * 100),
    }
    acc += dash
    return seg
  })

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">No data yet.</p>
      ) : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label={title}>
            <g transform="rotate(-90 70 70)">
              {segments.map((s, i) => (
                <circle
                  key={i}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={`${s.dash} ${C - s.dash}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
          </svg>
          <ul className="flex-1 space-y-2">
            {segments.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-text-secondary">{s.label}</span>
                <span className="font-semibold text-text-primary">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
