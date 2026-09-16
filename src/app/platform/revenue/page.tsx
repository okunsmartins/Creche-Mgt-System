import type { Metadata } from 'next'
import { TrendingUp, Calendar, Percent } from 'lucide-react'
import { getRevenueOverview } from '@/lib/platform/revenue'
import { StatCard } from '@/components/platform/StatCard'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarChart } from '@/components/charts/BarChart'

export const metadata: Metadata = { title: 'Revenue — Platform' }

function euro(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export default async function PlatformRevenuePage() {
  const r = await getRevenueOverview()

  const mrrLabel = r.mrrSource === 'stripe' ? 'MRR' : 'Est. MRR'
  const mrrHint =
    r.mrrSource === 'stripe'
      ? 'from Stripe active subscriptions'
      : 'estimate — assumes monthly pricing'

  const funnel = [
    { label: 'Trialing', value: r.funnel.trialing },
    { label: 'Active (paid)', value: r.funnel.active },
    { label: 'Past due', value: r.funnel.pastDue },
    { label: 'Churned', value: r.funnel.churned },
  ]

  const topSchoolsChart = r.topSchools.map((s) => ({ label: s.name, value: s.collectedCents }))

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={mrrLabel}
          value={euro(r.mrrCents)}
          hint={mrrHint}
          icon={TrendingUp}
          glow="card-glow-green"
        />
        <StatCard
          label="Est. ARR"
          value={euro(r.arrCents)}
          hint="MRR × 12"
          icon={Calendar}
          glow="card-glow-blue"
        />
        <StatCard
          label="Past-trial conversion"
          value={r.pastTrialConversionPct === null ? '—' : `${r.pastTrialConversionPct}%`}
          hint="paying ÷ (paying + churned)"
          icon={Percent}
          glow="card-glow-amber"
        />
      </div>

      <DonutChart title="Subscription funnel" data={funnel} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Top schools by revenue
        </h2>
        {topSchoolsChart.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            No collected payments yet.
          </p>
        ) : (
          <BarChart title="All-time collected" data={topSchoolsChart} formatValue={euro} />
        )}
      </div>

      <p className="text-xs text-text-muted">
        Conversion is point-in-time (share of past-trial schools now paying); cohort trends need
        subscription history we don&apos;t yet store. Revenue is all-time collected (paid −
        refunded).
      </p>
    </div>
  )
}
