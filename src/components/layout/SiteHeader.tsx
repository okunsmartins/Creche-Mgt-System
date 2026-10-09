'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, LogOut, LogIn } from 'lucide-react'
import { MobileNav } from './MobileNav'
import { SchoolCrest } from './SchoolCrest'
import { signOutAction } from '@/lib/auth/actions'

// School-facing nav — shown only inside a crèche's portal (a tenant is active).
const schoolLinks = [
  { href: '/', label: 'Home' },
  { href: '/activities', label: 'Activities' },
  { href: '/programmes', label: 'Programmes' },
  { href: '/guest-payment', label: 'Pay as Guest' },
  { href: '/login', label: 'Parent Login' },
]

// Platform/marketing nav — shown on the bare apex site (no school identified).
const platformLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/contact', label: 'Contact' },
]

// Shared pill styles (match the marketing design).
const pillOutline =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 border-text-primary px-4 py-1.5 text-sm font-extrabold text-text-primary transition-colors hover:border-primary hover:text-primary'
const pillOutlineActive =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 text-sm font-extrabold text-primary'
const pillSunny =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-accent-sunny px-4 py-1.5 text-sm font-extrabold text-text-primary transition-transform hover:-translate-y-0.5'

export function SiteHeader({
  schoolName,
  schoolLogoUrl,
  isTenant = false,
  tenantSlug,
  isAuthenticated = false,
}: {
  schoolName?: string | null
  schoolLogoUrl?: string | null
  /** True when a specific school's portal is active (subdomain, `/s/<school>` path, or session). */
  isTenant?: boolean
  /** Set when the tenant came from a `/s/<school>` PATH — school links get prefixed to keep context. */
  tenantSlug?: string | undefined
  /** Whether a user is signed in — on the platform nav this swaps Sign in → Sign out. */
  isAuthenticated?: boolean
}) {
  const pathname = usePathname()
  // No school identified (apex host, signed out) → platform branding, not a
  // school's. Must not duplicate the "Admin Portal" subtitle below.
  const brandName = schoolName ?? 'Creche Wise'

  // Prefix a crèche link with the `/s/<school>` path when browsing via path (so
  // clicking a link keeps the crèche in context). No-op for host/session tenants.
  const withTenant = (href: string) =>
    tenantSlug ? (href === '/' ? `/s/${tenantSlug}` : `/s/${tenantSlug}${href}`) : href

  // Normalize the current path to its bare form (strip a `/s/<school>` prefix)
  // so active-state matches whether the URL is prefixed or rewritten.
  const barePath =
    tenantSlug && pathname.startsWith(`/s/${tenantSlug}`)
      ? pathname.slice(`/s/${tenantSlug}`.length) || '/'
      : pathname

  const isActive = (href: string) =>
    href === '/' ? barePath === '/' : barePath === href || barePath.startsWith(href + '/')

  const isAdminActive = pathname.startsWith('/admin')

  const linkClass = (href: string) =>
    isActive(href)
      ? 'text-[15px] font-bold text-primary underline decoration-2 underline-offset-[6px]'
      : 'text-[15px] font-bold text-text-primary transition-colors hover:text-primary'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + school name */}
        <Link
          href={withTenant('/')}
          className="flex items-center gap-3"
          aria-label={`${brandName} home`}
        >
          <SchoolCrest name={brandName} size={40} logoUrl={schoolLogoUrl} />
          <span className="hidden font-display text-xl font-bold leading-tight text-text-primary sm:block">
            {brandName}
            {schoolName && (
              <>
                <br />
                <span className="font-sans text-xs font-semibold text-text-secondary">
                  Parent &amp; staff portal
                </span>
              </>
            )}
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex">
          {isTenant ? (
            <>
              {/* Inside a crèche portal: school-facing links + Admin + Exit portal. */}
              {schoolLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={withTenant(href)}
                  className={linkClass(href)}
                  aria-current={isActive(href) ? 'page' : undefined}
                >
                  {label}
                </Link>
              ))}

              <Link
                href="/admin/dashboard"
                aria-current={isAdminActive ? 'page' : undefined}
                className={isAdminActive ? pillOutlineActive : pillOutline}
              >
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Admin
              </Link>

              {/* Exit a crèche's portal → clears the tenant cookie (full nav so the
                  middleware response sets the cookie). */}
              <a
                href="/s/reset"
                title="Leave this school's portal"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-text-secondary transition-colors hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Exit portal
              </a>
            </>
          ) : (
            <>
              {/* Bare platform/apex site: marketing links + Sign in. */}
              {platformLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={linkClass(href)}
                  aria-current={isActive(href) ? 'page' : undefined}
                >
                  {label}
                </Link>
              ))}

              {isAuthenticated ? (
                <form action={signOutAction}>
                  <button type="submit" className={pillOutline}>
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              ) : (
                <>
                  <Link
                    href="/login"
                    aria-current={isActive('/login') ? 'page' : undefined}
                    className={isActive('/login') ? pillOutlineActive : pillOutline}
                  >
                    <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign in
                  </Link>
                  <Link href="/get-started" className={pillSunny}>
                    Start free month
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        {/* Mobile navigation */}
        <MobileNav
          links={
            isTenant
              ? [
                  ...schoolLinks.map((l) => ({ href: withTenant(l.href), label: l.label })),
                  { href: '/admin/dashboard', label: 'Admin' },
                ]
              : isAuthenticated
                ? platformLinks
                : [
                    ...platformLinks,
                    { href: '/login', label: 'Sign in' },
                    { href: '/get-started', label: 'Start free month' },
                  ]
          }
          signOut={!isTenant && isAuthenticated}
        />
      </div>
    </header>
  )
}
