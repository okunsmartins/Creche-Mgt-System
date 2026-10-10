'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Icon3D } from '@/components/ui/Icon3D'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/types'

import { FUNDING_SECTION, NAV_SECTIONS, type NavItem, type NavSection } from './adminNav'
interface AdminSidebarProps {
  user: SessionUser
  /** Platform owner — shows the owner-only "Schools" (all-schools) link. */
  isOwner?: boolean
  /** Funding & Hive Centre enabled for this tenant — shows the Funding section. */
  fundingEnabled?: boolean
}

const groupId = (title: string) => `nav-group-${title.toLowerCase().replace(/\s+/g, '-')}`

export function AdminSidebar({ user, isOwner = false, fundingEnabled = false }: AdminSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentView = searchParams.get('view')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Insert the Funding section (before Reports) only when the tenant has the feature
  // flag on and the user holds funding.view — otherwise the module stays hidden.
  const showFunding = fundingEnabled && user.permissions.includes('funding.view')
  const sections: NavSection[] = showFunding
    ? NAV_SECTIONS.flatMap((s) => (s.title === 'Reports' ? [FUNDING_SECTION, s] : [s]))
    : NAV_SECTIONS

  // All nav hrefs, for most-specific active matching (so a parent like
  // /admin/attendance and its /summary child don't both highlight).
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href))
  const matchesPath = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const viewOf = (href: string) => {
    const q = href.split('?')[1]
    return q ? new URLSearchParams(q).get('view') : null
  }
  // Query-aware active matching: two links can share a path and differ only by `?view=`
  // (e.g. Attendance vs Monthly Summary). A query link is active when the path matches and
  // its `view` matches the URL; a plain link yields to a sibling query link that is active.
  const isHrefActive = (href: string) => {
    const path = href.split('?')[0] ?? href
    const hrefView = viewOf(href)
    if (hrefView) return pathname === path && currentView === hrefView
    if (!matchesPath(path)) return false
    const moreSpecific = allHrefs.some(
      (o) =>
        o !== href &&
        (o.split('?')[0] ?? o).startsWith(`${path}/`) &&
        matchesPath(o.split('?')[0] ?? o),
    )
    if (moreSpecific) return false
    // A sibling query link on the same path (e.g. ?view=month) owns the highlight instead.
    const siblingQueryActive = allHrefs.some((o) => {
      const ov = viewOf(o)
      return ov !== null && (o.split('?')[0] ?? o) === path && currentView === ov
    })
    return !siblingQueryActive
  }
  const platformActive = matchesPath('/platform')

  // Groups fold away to keep ~50 links manageable. "Today" (daily use) and the group
  // holding the current page start open; the rest are one click away.
  const activeGroup = sections.find((s) => s.items.some((i) => isHrefActive(i.href)))?.title
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(['Today', ...(activeGroup ? [activeGroup] : [])]),
  )
  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-bold transition-colors duration-150',
      active
        ? 'bg-primary text-white shadow-[inset_0_-3px_0_#1b4fae]'
        : 'text-text-primary hover:bg-[#f3eee3]',
    )

  const tile = (Icon: NavItem['icon'], color: string, active: boolean) => (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)]"
      style={{ background: active ? 'rgba(255,255,255,0.22)' : color }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  )

  const sidebarContent = (
    <div className="flex h-full flex-col border-r border-border bg-[#fffdf8]">
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 pb-4 pt-14 lg:pt-4">
        {sections.map((section, si) => {
          const title = section.title
          const color = section.color ?? '#2463d6'
          const open = !title || openGroups.has(title)
          return (
            <div key={title ?? si} className={cn(si > 0 && 'mt-1')}>
              {title && (
                <button
                  type="button"
                  onClick={() => toggleGroup(title)}
                  aria-expanded={open}
                  aria-controls={groupId(title)}
                  className="flex w-full items-center justify-between rounded-lg px-2 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary"
                >
                  <span className="flex items-center gap-2">
                    {section.icon3d ? (
                      <Icon3D name={section.icon3d} size={22} />
                    ) : (
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    )}
                    {title}
                  </span>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')}
                    aria-hidden="true"
                  />
                </button>
              )}
              {open && (
                <ul id={title ? groupId(title) : undefined} className="space-y-0.5">
                  {section.items.map(({ href, label, icon: Icon }) => {
                    const isActive = isHrefActive(href)
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={linkClass(isActive)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {title ? (
                            tile(Icon, color, isActive)
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                            </span>
                          )}
                          {label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

        {/* Owner-only: all-schools overview (lives outside the crèche portal). */}
        {isOwner && (
          <div className="mt-1">
            <p className="px-2 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-secondary">
              Platform
            </p>
            <Link
              href="/platform"
              onClick={() => setMobileOpen(false)}
              className={linkClass(platformActive)}
              aria-current={platformActive ? 'page' : undefined}
            >
              {tile(Building2, '#1f2b57', platformActive)}
              Overview
            </Link>
          </div>
        )}

        {/* Help card */}
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#eee7ff] to-secondary-light p-4">
          <p className="font-display text-base font-bold text-text-primary">Need a hand?</p>
          <p className="mt-0.5 text-xs font-semibold text-text-secondary">
            We&apos;re happy to help you get set up.
          </p>
          <a
            href="mailto:support@crechewise.com"
            className="mt-3 inline-flex min-h-[36px] items-center rounded-xl bg-white px-3 text-[13px] font-extrabold text-[#6d3fd1]"
          >
            Email support →
          </a>
        </div>
      </nav>

      {/* Sign out */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <form action={signOutAction}>
          <button
            type="submit"
            suppressHydrationWarning
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-bold text-text-secondary transition-colors hover:bg-[#f3eee3] hover:text-text-primary"
          >
            <span className="flex h-7 w-7 items-center justify-center">
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger (sits over the left of the blue top bar) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-xl bg-white p-2.5 text-primary shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)] lg:hidden"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-text-secondary hover:text-text-primary"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{sidebarContent}</aside>
    </>
  )
}
