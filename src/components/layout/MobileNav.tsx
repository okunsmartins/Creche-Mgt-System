'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { signOutAction } from '@/lib/auth/actions'

interface NavLink {
  href: string
  label: string
}

export function MobileNav({ links, signOut = false }: { links: NavLink[]; signOut?: boolean }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(!open)}
        suppressHydrationWarning
        className="rounded-md p-2 text-text-secondary hover:bg-gray-100 hover:text-primary"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="absolute left-0 right-0 top-16 z-50 border-b border-border bg-surface px-4 py-4 shadow-md"
        >
          <ul className="flex flex-col gap-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={
                    isActive(href)
                      ? 'block rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary'
                      : 'block rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-primary-light hover:text-primary'
                  }
                >
                  {label}
                </Link>
              </li>
            ))}
            {signOut && (
              <li>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-primary-light hover:text-primary"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </button>
                </form>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  )
}
