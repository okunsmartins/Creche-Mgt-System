import Link from 'next/link'
import { Lock } from 'lucide-react'

/**
 * Pro-gated "Export CSV" control. Renders a real download link when the school
 * has Pro access, otherwise a locked link to the pricing page. CSV export is the
 * `advanced_reports` Pro feature; the report API routes also enforce this (403),
 * this is the matching UI affordance.
 */
export function ExportCsvLink({ href, isPro }: { href: string; isPro: boolean }) {
  if (isPro) {
    return (
      <a
        href={href}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface"
      >
        Export CSV
      </a>
    )
  }
  return (
    <Link
      href="/pricing?locked=advanced_reports"
      title="CSV export is a Pro feature"
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:border-primary/40 hover:text-primary"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      Export CSV (Pro)
    </Link>
  )
}
