'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut, ShoppingCart, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SchoolCrest } from './SchoolCrest'
import { signOutAction } from '@/lib/auth/actions'
import { useParentBasket } from '@/lib/basket/useParentBasket'
import type { SessionUser } from '@/types'

interface NavLink {
  href: string
  label: string
}

interface NavGroup {
  label: string
  items: NavLink[]
}

type NavEntry = NavLink | NavGroup

const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry

/**
 * Parent navigation. Related destinations are grouped under a single dropdown so
 * the top bar stays legible (was 11 flat links). Order is stable across desktop
 * and mobile.
 */
const NAV: NavEntry[] = [
  { href: '/parent/dashboard', label: 'Dashboard' },
  { href: '/parent/children', label: 'My Children' },
  {
    label: 'Learning',
    items: [
      { href: '/parent/attendance', label: 'Attendance' },
      { href: '/parent/assignments', label: 'Assignments' },
      { href: '/parent/reports', label: 'Reports' },
    ],
  },
  {
    label: 'Activities',
    items: [
      { href: '/parent/activities', label: 'Activities' },
      { href: '/parent/programmes', label: 'Programmes' },
    ],
  },
  {
    label: 'Contact',
    items: [
      { href: '/parent/messages', label: 'Messages' },
      { href: '/parent/meetings', label: 'Meetings' },
    ],
  },
  {
    label: 'Crèche',
    items: [
      { href: '/parent/invoices', label: 'Fees & Invoices' },
      { href: '/parent/permission-slips', label: 'Permission Slips' },
      { href: '/parent/collectors', label: 'Who Can Collect' },
      { href: '/parent/payments', label: 'Payments' },
    ],
  },
]

const isLinkActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

interface ParentHeaderProps {
  user: SessionUser
  logoUrl?: string | null
}

export function ParentHeader({ user, logoUrl }: ParentHeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { items } = useParentBasket()
  const basketCount = items.length

  const displayName = user.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user.email

  const initials = user.profile
    ? `${user.profile.firstName[0] ?? ''}${user.profile.lastName[0] ?? ''}`.toUpperCase()
    : (user.email[0]?.toUpperCase() ?? '?')
  // Fall back to the product name (never "Admin Portal") so an unattached
  // account never mislabels the crest. Once the crèche is attached this shows
  // the crèche's own name + crest.
  const brandName = user.schoolName ?? 'Creche Wise'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/parent/dashboard" className="flex items-center gap-3" aria-label="Dashboard">
          <SchoolCrest name={brandName} size={36} logoUrl={logoUrl} />
          <span className="hidden text-sm font-bold leading-tight text-primary sm:block">
            {brandName}
            <br />
            <span className="text-xs font-normal text-text-secondary">Parent Portal</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Parent navigation" className="hidden items-center gap-1 lg:flex">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <NavDropdown key={entry.label} group={entry} pathname={pathname} />
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isLinkActive(pathname, entry.href)
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-primary',
                )}
                aria-current={isLinkActive(pathname, entry.href) ? 'page' : undefined}
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>

        {/* Desktop: basket icon */}
        <Link
          href="/parent/basket"
          aria-label={basketCount > 0 ? `Basket (${basketCount} items)` : 'Basket'}
          className="relative hidden p-1 text-text-secondary hover:text-primary lg:block"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          {basketCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
            >
              {basketCount > 9 ? '9+' : basketCount}
            </span>
          )}
        </Link>

        {/* Desktop: user avatar + sign out */}
        <div className="hidden items-center gap-3 lg:flex">
          <span className="hidden text-sm text-text-muted xl:inline">{displayName}</span>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
            aria-hidden="true"
          >
            {initials}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              suppressHydrationWarning
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="rounded-md p-2 text-text-secondary hover:bg-gray-100 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          suppressHydrationWarning
        >
          {mobileOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav aria-label="Mobile parent navigation" className="px-4 py-3">
            <ul className="space-y-1">
              {NAV.map((entry) =>
                isGroup(entry) ? (
                  <li key={entry.label} className="pt-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                      {entry.label}
                    </p>
                    <ul className="space-y-1">
                      {entry.items.map(({ href, label }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'block rounded-md px-3 py-2 text-sm font-medium',
                              isLinkActive(pathname, href)
                                ? 'bg-primary-light text-primary'
                                : 'text-text-secondary hover:bg-gray-50 hover:text-primary',
                            )}
                            aria-current={isLinkActive(pathname, href) ? 'page' : undefined}
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm font-medium',
                        isLinkActive(pathname, entry.href)
                          ? 'bg-primary-light text-primary'
                          : 'text-text-secondary hover:bg-gray-50 hover:text-primary',
                      )}
                      aria-current={isLinkActive(pathname, entry.href) ? 'page' : undefined}
                    >
                      {entry.label}
                    </Link>
                  </li>
                ),
              )}
              <li>
                <Link
                  href="/parent/basket"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                    pathname === '/parent/basket'
                      ? 'bg-primary-light text-primary'
                      : 'text-text-secondary hover:bg-gray-50 hover:text-primary',
                  )}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Basket
                  {basketCount > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {basketCount}
                    </span>
                  )}
                </Link>
              </li>
            </ul>
            <div className="mt-3 border-t border-border pt-3">
              <p className="px-3 text-xs text-text-muted">{displayName}</p>
              <form action={signOutAction} className="mt-1">
                <button
                  type="submit"
                  suppressHydrationWarning
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

/**
 * A single desktop nav dropdown. Opens on click, closes on outside click,
 * Escape, or a route change. Highlighted when any child route is active.
 */
function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const groupActive = group.items.some((item) => isLinkActive(pathname, item.href))

  // Close whenever the route changes (a child link was followed).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        suppressHydrationWarning
        className={cn(
          'flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
          groupActive || open ? 'text-primary' : 'text-text-secondary hover:text-primary',
        )}
      >
        {group.label}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-xl border border-border bg-surface p-1 shadow-lg">
          {group.items.map(({ href, label }) => {
            const active = isLinkActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-gray-50 hover:text-primary',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
