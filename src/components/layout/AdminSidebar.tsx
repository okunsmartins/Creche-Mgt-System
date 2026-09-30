'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  LogOut,
  Menu,
  X,
  ChevronRight,
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
  Building2,
  FileText,
  Banknote,
  Receipt,
  Scale,
  AlertCircle,
  Bell,
  LogIn,
  NotebookPen,
  UserPlus,
  Upload,
} from 'lucide-react'
import { cn, schoolInitials } from '@/lib/utils'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Children',
    items: [
      { href: '/admin/students', label: 'Children', icon: Users },
      { href: '/admin/enquiries', label: 'Enquiries', icon: UserPlus },
      { href: '/admin/import', label: 'Import', icon: Upload },
      { href: '/admin/daily-records', label: 'Daily Records', icon: NotebookPen },
      { href: '/admin/assignments', label: 'Assignments', icon: FileText },
      { href: '/admin/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
      { href: '/admin/link-requests', label: 'Link Requests', icon: ChevronRight },
    ],
  },
  {
    title: 'Staff',
    items: [
      { href: '/admin/teachers', label: 'Staff', icon: GraduationCap },
      { href: '/admin/classes', label: 'Rooms', icon: BookOpen },
      { href: '/admin/ratios', label: 'Ratios', icon: Scale },
      { href: '/admin/time-off', label: 'Time Off', icon: CalendarOff },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { href: '/admin/check-in', label: 'Daily Check-in', icon: LogIn },
      { href: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
      { href: '/admin/attendance/summary', label: 'Summary', icon: BarChart2 },
    ],
  },
  {
    title: 'Payments',
    items: [
      { href: '/admin/fees', label: 'Fees & Invoices', icon: Receipt },
      { href: '/admin/arrears', label: 'Arrears', icon: AlertCircle },
      { href: '/admin/reminders', label: 'Reminders', icon: Bell },
      { href: '/admin/activities', label: 'Activities', icon: Calendar },
      { href: '/admin/programmes', label: 'Programmes', icon: Repeat },
      { href: '/admin/payment-links', label: 'Payment Links', icon: Link2 },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/payments/connect', label: 'Payment Setup', icon: Banknote },
      { href: '/admin/refunds', label: 'Refunds', icon: RotateCcw },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/admin/messages', label: 'Messages', icon: Mail },
      { href: '/admin/sms', label: 'Text Parents', icon: MessageSquare },
    ],
  },
  {
    title: 'Reports',
    items: [{ href: '/admin/reports', label: 'Reports', icon: BarChart2 }],
  },
  {
    title: 'Administration',
    items: [
      { href: '/admin/settings', label: 'Crèche Settings', icon: Settings },
      { href: '/admin/subscription', label: 'Subscription', icon: Sparkles },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: GitMerge },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/admin/users', label: 'Users & Roles', icon: Shield },
    ],
  },
]

interface AdminSidebarProps {
  user: SessionUser
  logoUrl?: string | null
  /** Platform owner — shows the owner-only "Schools" (all-schools) link. */
  isOwner?: boolean
}

export function AdminSidebar({ user, logoUrl, isOwner = false }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // All nav hrefs, for most-specific active matching (so a parent like
  // /admin/attendance and its /summary child don't both highlight).
  const allHrefs = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href))
  const matchesPath = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const isHrefActive = (href: string) =>
    matchesPath(href) &&
    !allHrefs.some((other) => other !== href && other.startsWith(`${href}/`) && matchesPath(other))
  const platformActive = matchesPath('/platform')

  const brandName = user.schoolName ?? 'Creche Wise'
  const firstName = user.profile?.firstName ?? ''
  const lastName = user.profile?.lastName ?? ''
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : user.email
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : (user.email[0]?.toUpperCase() ?? '?')

  const sidebarContent = (
    <div className="sidebar-gradient flex h-full flex-col">
      {/* Logo / Brand */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/15 px-5 py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase URL; avoids next/image domain config
          <img
            src={logoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-white/30"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30">
            <span className="text-xs font-bold text-white">{schoolInitials(brandName)}</span>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-white">{brandName}</p>
          <p className="text-[10px] text-white/70">Admin Portal</p>
        </div>
      </div>

      {/* User profile block */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/15 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white ring-1 ring-white/30">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="text-[10px] text-white/70">Administrator</p>
        </div>
        <Link
          href="/admin/settings"
          aria-label="School settings"
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          onClick={() => setMobileOpen(false)}
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={cn('mb-3', si > 0 && 'mt-1')}>
            {section.title && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/60">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const isActive = isHrefActive(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white text-primary shadow-sm'
                          : 'text-white/80 hover:bg-white/15 hover:text-white',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-primary' : 'text-white/80',
                        )}
                        aria-hidden="true"
                      />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Owner-only: all-schools overview (lives outside the crèche portal). */}
        {isOwner && (
          <div className="mb-3 mt-1">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/60">
              Platform
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/platform"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    platformActive
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-white/80 hover:bg-white/15 hover:text-white',
                  )}
                  aria-current={platformActive ? 'page' : undefined}
                >
                  <Building2
                    className={cn(
                      'h-4 w-4 shrink-0',
                      platformActive ? 'text-primary' : 'text-white/80',
                    )}
                    aria-hidden="true"
                  />
                  Overview
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Sign out */}
      <div className="shrink-0 border-t border-white/15 px-3 py-3">
        <form action={signOutAction}>
          <button
            type="submit"
            suppressHydrationWarning
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 transition-all hover:bg-white/15 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-surface p-2.5 text-text-primary shadow-lg ring-1 ring-border lg:hidden"
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
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-white/80 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 shadow-sidebar lg:block">{sidebarContent}</aside>
    </>
  )
}
