'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardCheck,
  BarChart3,
  Mail,
  MessageSquare,
  CalendarOff,
  CalendarClock,
  FileText,
  GraduationCap,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn, schoolInitials } from '@/lib/utils'
import { signOutAction } from '@/lib/auth/actions'
import type { SessionUser } from '@/types'

const NAV = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/teacher/attendance/summary', label: 'Summary', icon: BarChart3 },
  { href: '/teacher/assignments', label: 'Assignments', icon: FileText },
  { href: '/teacher/reports', label: 'Reports', icon: GraduationCap },
  { href: '/teacher/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
  { href: '/teacher/messages', label: 'Messages', icon: Mail },
  { href: '/teacher/sms', label: 'Text Parents', icon: MessageSquare },
  { href: '/teacher/time-off', label: 'Time Off', icon: CalendarOff },
  { href: '/teacher/meetings', label: 'Meetings', icon: CalendarClock },
]

export function TeacherSidebar({ user, logoUrl }: { user: SessionUser; logoUrl?: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const initials = user.profile
    ? `${user.profile.firstName[0] ?? ''}${user.profile.lastName[0] ?? ''}`.toUpperCase()
    : user.email.slice(0, 2).toUpperCase()
  const brandName = user.schoolName ?? 'Skool Bido'

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-20 z-40 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised ring-1 ring-border lg:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 flex h-full w-56 flex-col border-r border-border bg-surface pt-16 transition-transform lg:relative lg:translate-x-0 lg:pt-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* School identity */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase URL; avoids next/image domain config
            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {schoolInitials(brandName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{brandName}</p>
            <p className="text-xs text-text-muted">Teacher Portal</p>
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold text-text-secondary ring-1 ring-border">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text-primary">
              {user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email}
            </p>
            <p className="text-xs text-text-muted">Teacher</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            // Most-specific match wins so /teacher/attendance and its /summary
            // child don't both highlight.
            const matches = (p: string) => pathname === p || pathname.startsWith(p + '/')
            const active =
              matches(href) &&
              !NAV.some(
                (other) =>
                  other.href !== href && other.href.startsWith(href + '/') && matches(other.href),
              )
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t border-border px-2 py-3">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-red-400"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
