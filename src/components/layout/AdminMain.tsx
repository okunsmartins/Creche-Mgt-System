'use client'

import { usePathname } from 'next/navigation'
import { pageIconFor } from './adminNav'

/**
 * The admin content area. Applies the bright admin look (see `.admin-main` in
 * globals.css) to every page and sets the page's 3D icon, which CSS shows beside
 * the page title — so all ~80 admin pages match the dashboard without per-page code.
 */
export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const icon = pageIconFor(pathname)
  return (
    <main
      id="main-content"
      className="admin-main flex-1 p-4 sm:p-6 lg:p-8"
      data-dashboard={pathname === '/admin/dashboard' ? '' : undefined}
      style={{ ['--page-icon' as string]: `url(/icons/3d/${icon}.webp)` }}
    >
      {children}
    </main>
  )
}
