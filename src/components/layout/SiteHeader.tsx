'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, LogOut, LogIn } from 'lucide-react'
import { MobileNav } from './MobileNav'
import { SchoolCrest } from './SchoolCrest'
import { signOutAction } from '@/lib/auth/actions'

// School-facing nav — shown only inside a school's portal (a tenant is active).
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
  { href: '/get-started', label: 'Create your Portal' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/contact', label: 'Get in Touch' },
]

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
  const brandName = schoolName ?? 'Crèche Management System'

  // Prefix a school link with the `/s/<school>` path when browsing via path (so
  // clicking a link keeps the school in context). No-op for host/session tenants.
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
      ? 'text-sm font-semibold text-primary underline underline-offset-4'
      : 'text-sm font-medium text-text-secondary transition-colors hover:text-primary'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + school name */}
        <Link
          href={withTenant('/')}
          className="flex items-center gap-3"
          aria-label={`${brandName} home`}
        >
          <SchoolCrest name={brandName} size={40} logoUrl={schoolLogoUrl} />
          <span className="hidden text-sm font-bold leading-tight text-primary sm:block">
            {brandName}
            {schoolName && (
              <>
                <br />
                <span className="text-xs font-normal text-text-secondary">Admin Portal</span>
              </>
            )}
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {isTenant ? (
            <>
              {/* Inside a school portal: school-facing links + Admin + Exit portal. */}
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
                className={
                  isAdminActive
                    ? 'inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'
                    : 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                }
              >
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                Admin
              </Link>

              {/* Exit a school's portal → clears the tenant cookie (full nav so the
                  middleware response sets the cookie). */}
              <a
                href="/s/reset"
                title="Leave this school's portal"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-all hover:border-primary/40 hover:text-primary"
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
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  aria-current={isActive('/login') ? 'page' : undefined}
                  className={
                    isActive('/login')
                      ? 'inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'
                      : 'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-muted transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                  }
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign in
                </Link>
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
                : [...platformLinks, { href: '/login', label: 'Sign in' }]
          }
          signOut={!isTenant && isAuthenticated}
        />
      </div>
    </header>
  )
}
