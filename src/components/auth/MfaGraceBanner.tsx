import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { adminMfaDecision, type AdminMfaState } from '@/lib/auth/mfa-policy'

/** Reminder for admins who haven't set up two-step sign-in yet (inside the grace period). */
export function MfaGraceBanner({ mfa }: { mfa: AdminMfaState | null | undefined }) {
  const d = adminMfaDecision(mfa)
  if (d.kind !== 'grace') return null
  const deadline = new Date(d.deadline).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Dublin',
  })
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-text-primary sm:px-6"
    >
      <ShieldAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>Set up two-step sign-in.</strong> Admin accounts need a code from your phone as well
        as your password. {d.daysLeft} day{d.daysLeft === 1 ? '' : 's'} left (until {deadline}).
      </span>
      <Link
        href="/mfa/setup"
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
      >
        Set up now
      </Link>
    </div>
  )
}
