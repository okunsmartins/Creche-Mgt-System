import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Archive,
  Clock,
  Building2,
  Sparkles,
  Users,
  Wallet,
  TrendingUp,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { getPlatformOverview } from '@/lib/platform/overview'
import { StatCard } from '@/components/platform/StatCard'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Overview — Platform' }

function euro(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export default async function PlatformOverviewPage() {
  const o = await getPlatformOverview()

  const tiles: {
    label: string
    value: string
    icon: LucideIcon
    glow: string
    hint?: string
    href?: string
    cta?: string
  }[] = [
    {
      label: 'Active schools',
      value: String(o.schools.total),
      icon: Building2,
      glow: 'card-glow-blue',
      href: '/platform/schools',
      cta: 'View schools',
    },
    {
      label: 'Paid / trialing',
      value: `${o.schools.paid} / ${o.schools.trialing}`,
      hint: `${o.schools.withAccess} with access`,
      icon: Sparkles,
      glow: 'card-glow-green',
    },
    { label: 'Students', value: String(o.studentsTotal), icon: Users, glow: 'card-glow-teal' },
    {
      label: 'Collected this month',
      value: euro(o.collectedThisMonthCents),
      icon: Wallet,
      glow: 'card-glow-amber',
    },
    {
      label: o.mrrSource === 'stripe' ? 'MRR' : 'Est. MRR',
      value: euro(o.mrrCents),
      hint:
        o.mrrSource === 'stripe'
          ? 'from Stripe active subscriptions'
          : 'estimate — assumes monthly pricing',
      icon: TrendingUp,
      glow: 'card-glow-green',
      href: '/platform/revenue',
      cta: 'View revenue',
    },
    {
      label: 'SMS-enabled schools',
      value: String(o.sms.enabledSchools),
      icon: MessageSquare,
      glow: 'card-glow-teal',
    },
  ]

  const subscriptionMix = [
    { label: 'Paid', value: o.schools.paid },
    { label: 'Trialing', value: o.schools.trialing },
    { label: 'Free / lapsed', value: o.schools.free },
  ]

  const nothingToAction =
    o.attention.trialsExpiringSoon.length === 0 && o.attention.pastDue.length === 0

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <StatCard
            key={t.label}
            label={t.label}
            value={t.value}
            icon={t.icon}
            glow={t.glow}
            hint={t.hint}
            href={t.href}
            cta={t.cta}
          />
        ))}
      </div>

      <DonutChart title="Subscription mix" data={subscriptionMix} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Needs attention
        </h2>

        {nothingToAction ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            Nothing needs attention right now.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                Trials expiring soon ({o.attention.trialsExpiringSoon.length})
              </div>
              {o.attention.trialsExpiringSoon.length === 0 ? (
                <p className="text-sm text-text-muted">None in the next 7 days.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {o.attention.trialsExpiringSoon.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <span className="text-text-primary">{s.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {s.trialEndsAt ? formatDate(s.trialEndsAt) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <AlertTriangle className="h-4 w-4 text-error" aria-hidden="true" />
                Past due ({o.attention.pastDue.length})
              </div>
              {o.attention.pastDue.length === 0 ? (
                <p className="text-sm text-text-muted">No past-due subscriptions.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {o.attention.pastDue.map((s) => (
                    <li key={s.id} className="text-text-primary">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          See the full list in{' '}
          <Link href="/platform/schools" className="font-semibold text-primary hover:underline">
            Schools
          </Link>
          .
        </p>
        {o.schools.deactivated > 0 && (
          <Link
            href="/platform/schools"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-text-muted ring-1 ring-border hover:text-text-primary"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            {o.schools.deactivated} deactivated {o.schools.deactivated === 1 ? 'school' : 'schools'}
          </Link>
        )}
      </div>
    </div>
  )
}
