import Link from 'next/link'
import { Bell, CircleHelp, ExternalLink, Search } from 'lucide-react'
import type { SessionUser } from '@/types'
import { schoolInitials } from '@/lib/utils'

// Chunky square icon button (3D bottom edge), as in the dashboard redesign.
const sq =
  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.16)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-sunny'

/**
 * Admin top bar: royal-blue band with the crèche's identity, a children search
 * (GET → /admin/students?q=), alerts, help and the signed-in user.
 */
export function AdminTopBar({ user, logoUrl }: { user: SessionUser; logoUrl?: string | null }) {
  const schoolName = user.schoolName ?? 'Creche Wise'
  const first = user.profile?.firstName ?? ''
  const last = user.profile?.lastName ?? ''
  const initials =
    first && last ? `${first[0]}${last[0]}`.toUpperCase() : (user.email[0]?.toUpperCase() ?? '?')
  const displayName = first && last ? `${first} ${last}` : user.email

  return (
    <header className="no-print shrink-0 bg-gradient-to-b from-[#2e6fe0] to-primary text-white shadow-[0_4px_0_#1b4fae]">
      <div className="flex h-16 items-center gap-3 pl-16 pr-4 sm:gap-4 lg:pl-5 lg:pr-6">
        <Link
          href="/admin/dashboard"
          className="flex min-w-0 shrink-0 items-center gap-2.5"
          aria-label={`${schoolName} dashboard`}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase URL
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-10 rounded-xl bg-white object-cover shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-display text-base font-bold text-primary shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]">
              {schoolInitials(schoolName)}
            </span>
          )}
          <span className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="truncate font-display text-lg font-bold">{schoolName}</span>
            <span className="text-[11px] font-bold text-white/75">Admin · Creche Wise</span>
          </span>
        </Link>

        <form
          action="/admin/students"
          method="get"
          role="search"
          className="ml-auto flex h-10 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-full bg-white px-4 text-text-secondary shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] md:ml-4"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            type="search"
            name="q"
            placeholder="Search children…"
            aria-label="Search children"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/dashboard#attention"
            aria-label="Alerts — see what needs attention"
            title="Needs attention"
            className={`${sq} bg-accent-leaf text-white`}
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          <a
            href="mailto:support@crechewise.com"
            aria-label="Help — email Creche Wise support"
            title="Help"
            className={`${sq} hidden bg-accent-grape text-white sm:flex`}
          >
            <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
          </a>
          <Link
            href="/"
            aria-label="View your crèche's public page"
            title="View your public page"
            className={`${sq} hidden bg-accent-sunny text-text-primary sm:flex`}
          >
            <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          <Link
            href="/admin/settings"
            title={displayName}
            aria-label={`${displayName} — crèche settings`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-secondary-light text-sm font-extrabold text-secondary"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  )
}
