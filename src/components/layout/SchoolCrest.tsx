import { schoolInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * The header crest, drawn from the school's initials so it is correct per tenant.
 *
 * Replaces the old static `branding/scoil-bhride-logo.svg`, which had "SCOIL DEMO"
 * baked in and therefore showed one school's identity on every school's portal.
 * Keeps the recolored purple + gold look. A real per-tenant logo (uploaded crest)
 * is Phase 2; until then this at least never names the wrong school.
 */
export function SchoolCrest({
  name,
  size = 40,
  className,
  logoUrl,
}: {
  name: string
  size?: number
  className?: string
  /** When set, the uploaded logo is shown instead of the initials crest. */
  logoUrl?: string | null | undefined
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Supabase URL; avoids next/image domain config
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className={cn('inline-block shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = schoolInitials(name)
  return (
    <span
      role="img"
      aria-label={`${name} crest`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: '#48347d',
        color: '#d4a017',
        boxShadow: 'inset 0 0 0 2px #d4a017',
        fontSize: Math.round(size * 0.34),
        letterSpacing: '0.02em',
      }}
    >
      {initials}
    </span>
  )
}
