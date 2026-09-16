import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'

interface UpgradePromptProps {
  title?: string
  description?: string
  /** Button label — override for tiers other than plain Pro (e.g. Pro + SMS). */
  cta?: string
  /** Where the button links — defaults to /pricing (plain Pro). */
  href?: string
}

/**
 * Inline "this is a Pro feature" prompt shown on locked pages (instead of a hard
 * redirect) so admins can see what Pro unlocks and upgrade in one click.
 */
export function UpgradePrompt({
  title = 'This is a Pro feature',
  description = 'Upgrade your plan to unlock this feature for your school.',
  cta = 'Upgrade to Pro',
  href = '/pricing',
}: UpgradePromptProps) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{description}</p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
      >
        {cta}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
