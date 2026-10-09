'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Repeat,
  ShoppingCart,
  CreditCard,
  RotateCcw,
  BarChart2,
  Shield,
  ShieldCheck,
  Award,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  GitMerge,
  ScrollText,
  GraduationCap,
  BookOpen,
  Link2,
  Settings,
  ClipboardCheck,
  Sparkles,
  Mail,
  MessageSquare,
  CalendarOff,
  CalendarClock,
  Clock,
  ClipboardList,
  Building2,
  FileText,
  Banknote,
  Bus,
  Receipt,
  Scale,
  AlertCircle,
  Bell,
  LogIn,
  Landmark,
  NotebookPen,
  TrendingUp,
  UserPlus,
  UserCheck,
  Upload,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  title?: string
  /** Group colour for the icon tiles (rainbow brand palette, white icon ≥ 4.5:1). */
  color?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Today',
    color: '#2b8a3e',
    items: [
      { href: '/admin/check-in', label: 'Daily Check-in', icon: LogIn },
      { href: '/admin/daily-records', label: 'Daily Records', icon: NotebookPen },
      { href: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
      { href: '/admin/attendance?view=month', label: 'Monthly Summary', icon: BarChart2 },
    ],
  },
  {
    title: 'Children',
    color: '#d6336c',
    items: [
      { href: '/admin/students', label: 'Children', icon: Users },
      { href: '/admin/places', label: 'Places & Vacancies', icon: Building2 },
      { href: '/admin/enquiries', label: 'Enquiries', icon: UserPlus },
      { href: '/admin/import', label: 'Import', icon: Upload },
      { href: '/admin/assignments', label: 'Assignments', icon: FileText },
      { href: '/admin/observations', label: 'Learning Journals', icon: BookOpen },
      { href: '/admin/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
      { href: '/admin/collectors', label: 'Collectors', icon: UserCheck },
      { href: '/admin/link-requests', label: 'Link Requests', icon: ChevronRight },
    ],
  },
  {
    title: 'Staff',
    color: '#7048e8',
    items: [
      { href: '/admin/teachers', label: 'Staff', icon: GraduationCap },
      { href: '/admin/classes', label: 'Rooms', icon: BookOpen },
      { href: '/admin/rota', label: 'Rota', icon: CalendarClock },
      { href: '/admin/staff-attendance', label: 'Staff Clock-in', icon: Clock },
      { href: '/admin/timesheets', label: 'Timesheets', icon: ClipboardList },
      { href: '/admin/payroll', label: 'Payroll', icon: Banknote },
      { href: '/admin/ratios', label: 'Ratios', icon: Scale },
      { href: '/admin/time-off', label: 'Time Off', icon: CalendarOff },
      { href: '/admin/vetting', label: 'Garda Vetting', icon: ShieldCheck },
      { href: '/admin/certifications', label: 'Quals & Training', icon: Award },
    ],
  },
  {
    title: 'Money',
    color: '#b07200',
    items: [
      { href: '/admin/fees', label: 'Fees & Invoices', icon: Receipt },
      { href: '/admin/fees/due', label: 'Fees Due', icon: CalendarClock },
      { href: '/admin/arrears', label: 'Arrears', icon: AlertCircle },
      { href: '/admin/reminders', label: 'Reminders', icon: Bell },
      { href: '/admin/late-collection', label: 'Late Collection', icon: Timer },
      { href: '/admin/activities', label: 'Activities', icon: Calendar },
      { href: '/admin/programmes', label: 'Programmes', icon: Repeat },
      { href: '/admin/collection', label: 'School Collection', icon: Bus },
      { href: '/admin/payment-links', label: 'Payment Links', icon: Link2 },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/payments/connect', label: 'Payment Setup', icon: Banknote },
      { href: '/admin/refunds', label: 'Refunds', icon: RotateCcw },
    ],
  },
  {
    title: 'Parents',
    color: '#1c7ed6',
    items: [
      { href: '/admin/messages', label: 'Messages', icon: Mail },
      { href: '/admin/sms', label: 'Text Parents', icon: MessageSquare },
    ],
  },
  {
    title: 'Reports',
    color: '#4a5578',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
      { href: '/admin/commercial', label: 'Commercial', icon: TrendingUp },
      { href: '/admin/subvention-report', label: 'Subvention', icon: Landmark },
    ],
  },
  {
    title: 'Administration',
    color: '#4a5578',
    items: [
      { href: '/admin/settings', label: 'Crèche Settings', icon: Settings },
      { href: '/admin/subscription', label: 'Subscription', icon: Sparkles },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: GitMerge },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/admin/users', label: 'Users & Roles', icon: Shield },
    ],
  },
]

const FUNDING_SECTION: NavSection = {
  title: 'Funding',
  color: '#2b8a3e',
  items: [{ href: '/admin/funding', label: 'Funding & Hive', icon: Landmark }],
}

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
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
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
