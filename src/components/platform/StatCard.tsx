import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  /** One of the `card-glow-*` gradient classes (green/teal/blue/amber). */
  glow: string
  hint?: string | undefined
  href?: string | undefined
  cta?: string | undefined
}

/**
 * Gradient stat card matching the principal dashboard (icon box, big value,
 * label, optional hover-reveal CTA). Renders as a Link when `href` is set.
 */
export function StatCard({ label, value, icon: Icon, glow, hint, href, cta }: StatCardProps) {
  const cls = `${glow} group relative block overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`

  const inner = (
    <>
      {/* Shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
        aria-hidden="true"
      />
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10 transition-all group-hover:bg-white group-hover:ring-primary/25">
        <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-text-primary transition-transform group-hover:-translate-y-0.5">
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium text-text-secondary transition-transform group-hover:-translate-y-0.5">
        {label}
      </p>
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
      {href && cta && (
        <div className="mt-4 overflow-hidden">
          <div className="flex translate-y-8 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20 backdrop-blur-sm">
              {cta}
              <ArrowRight
                className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>
      )}
    </>
  )

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}
