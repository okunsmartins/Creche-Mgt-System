import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, CreditCard, History, CalendarDays, ArrowRight, ClipboardCheck } from 'lucide-react'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { getParentPermissionSlips } from '@/lib/permission-slips/queries'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function ParentDashboardPage() {
  const user = await requireVerifiedAuth()

  const slipChildren = await getParentPermissionSlips(user.id)
  const awaitingSlips = slipChildren.reduce(
    (n, c) => n + c.slips.filter((s) => s.response === null).length,
    0,
  )

  const firstName = user.profile?.firstName || user.email.split('@')[0] || 'there'
  const fullName =
    user.profile?.firstName && user.profile?.lastName
      ? `${user.profile.firstName} ${user.profile.lastName}`
      : user.email

  const cards = [
    {
      href: '/parent/children',
      label: 'My Children',
      sublabel: 'Manage linked children',
      icon: Users,
      glow: 'card-glow-green',
      cta: 'Manage children',
    },
    {
      href: '/parent/activities',
      label: 'Pay for Activities',
      sublabel: 'Browse & pay securely',
      icon: CreditCard,
      glow: 'card-glow-teal',
      cta: 'Browse activities',
    },
    {
      href: '/parent/programmes',
      label: 'Enrol in Programmes',
      sublabel: 'Recurring weekly sessions',
      icon: CalendarDays,
      glow: 'card-glow-amber',
      cta: 'Browse programmes',
    },
    {
      href: '/parent/payments',
      label: 'Payment History',
      sublabel: 'View orders & receipts',
      icon: History,
      glow: 'card-glow-blue',
      cta: 'View history',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {fullName} · {user.schoolName ?? 'Admin Portal'}
        </p>
      </div>

      {awaitingSlips > 0 && (
        <Link
          href="/parent/permission-slips"
          className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-5 py-4 transition-colors hover:bg-warning/20"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ClipboardCheck className="h-5 w-5 text-warning" aria-hidden="true" />
            {awaitingSlips} permission {awaitingSlips === 1 ? 'slip needs' : 'slips need'} your
            response
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
            Respond
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, label, sublabel, icon: Icon, glow, cta }) => (
          <Link
            key={href}
            href={href}
            className={`${glow} group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
          >
            {/* Shimmer sweep */}
            <div
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full"
              aria-hidden="true"
            />

            {/* Icon */}
            <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-primary/10 transition-all group-hover:bg-white group-hover:ring-primary/25">
              <Icon
                className="h-[18px] w-[18px] text-primary transition-colors"
                aria-hidden="true"
              />
            </div>

            {/* Label + sublabel — mirrors admin dashboard value + label pattern */}
            <p className="text-2xl font-bold tracking-tight text-text-primary transition-transform group-hover:-translate-y-0.5">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-text-secondary transition-transform group-hover:-translate-y-0.5">
              {sublabel}
            </p>

            {/* Hover-reveal CTA */}
            <div className="mt-4 overflow-hidden">
              <div className="flex translate-y-8 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/20 backdrop-blur-sm">
                  {cta}
                  <ArrowRight
                    className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
