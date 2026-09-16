import type { SessionUser } from '@/types'
import { Bell, Search } from 'lucide-react'

interface AdminHeaderProps {
  user: SessionUser
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const firstName = user.profile?.firstName ?? user.email.split('@')[0] ?? 'there'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6 pl-16 lg:pl-6">
      {/* Search */}
      <div className="relative hidden sm:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search..."
          aria-label="Search"
          className="h-9 w-56 rounded-xl border border-border bg-surface pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 lg:w-72"
        />
      </div>
      <div className="sm:hidden" />

      {/* Right */}
      <div className="flex items-center gap-3">
        <p className="hidden text-sm text-text-muted lg:block">
          Hey <span className="font-semibold text-text-primary">{firstName}</span> 👋
        </p>

        <button
          type="button"
          aria-label="Notifications"
          suppressHydrationWarning
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:border-primary/30 hover:text-primary"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/30"
          aria-hidden="true"
        >
          {user.profile
            ? `${user.profile.firstName[0] ?? ''}${user.profile.lastName[0] ?? ''}`.toUpperCase()
            : (user.email[0]?.toUpperCase() ?? '?')}
        </div>
      </div>
    </header>
  )
}
