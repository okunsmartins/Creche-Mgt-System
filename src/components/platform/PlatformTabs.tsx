'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/platform', label: 'Overview' },
  { href: '/platform/revenue', label: 'Revenue' },
  { href: '/platform/schools', label: 'Schools' },
  { href: '/platform/signups', label: 'Sign-ups' },
  { href: '/platform/settings', label: 'Settings' },
]

export function PlatformTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Platform sections" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const active =
          t.href === '/platform' ? pathname === '/platform' : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? '-mb-px border-b-2 border-primary px-4 py-2 text-sm font-semibold text-primary'
                : '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-primary'
            }
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
