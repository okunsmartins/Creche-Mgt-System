import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Check, ShieldCheck } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { getProPrices } from '@/lib/stripe/prices'
import { serverEnv } from '@/lib/env'
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'

export const metadata: Metadata = { title: 'Start your free trial' }

// The plan flips to trialing via the Stripe webhook after checkout, so always
// re-check on load rather than caching.
export const dynamic = 'force-dynamic'

const FEATURES: string[] = [
  'Fees & invoicing with automatic ECCE/NCS subvention',
  'Online parent payments (card & wallet) + guest pay',
  'Child, room & staff management',
  'Attendance, live ratios & daily records',
  'Payment links & instalments',
  'CSV import',
  'Reports: arrears, subvention & occupancy',
]

/**
 * Card-at-signup billing step, shown right after a new school is created. The
 * owner adds a card to start a {TRIAL_PERIOD_DAYS}-day free trial via Stripe
 * Checkout; Stripe collects the card now, charges nothing until the trial ends,
 * then auto-charges — no return visit needed. If the crèche already has access
 * (trial already started, or webhook already landed), skip straight to the app.
 */
export default async function OnboardingBillingPage() {
  const admin = await requireAdmin()
  if (admin.schoolId && (await schoolHasProAccess(admin.schoolId))) {
    redirect('/admin/dashboard')
  }

  const monthlyPriceId = serverEnv.stripeProMonthlyPriceId
  const annualPriceId = serverEnv.stripeProAnnualPriceId
  const subscriptionsEnabled = !!(monthlyPriceId || annualPriceId)
  const prices = subscriptionsEnabled ? await getProPrices() : { monthly: null, annual: null }

  return (
    <>
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Almost there
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Start your <span className="text-primary">{TRIAL_PERIOD_DAYS}-day free trial</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Add a card to activate your crèche portal. You won&apos;t be charged for{' '}
            {TRIAL_PERIOD_DAYS} days — cancel anytime before then and you pay nothing.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="card space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Pro plan</h2>
            <p className="mt-1 text-sm text-text-muted">
              Everything your crèche office needs. Free for {TRIAL_PERIOD_DAYS} days, then it renews
              automatically.
            </p>
            <p className="mt-4 text-3xl font-bold text-text-primary">
              €0
              <span className="text-base font-normal text-text-muted">
                {' '}
                for {TRIAL_PERIOD_DAYS} days
              </span>
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Then {prices.monthly ?? 'Pro'}/month
              {prices.annual ? `, or ${prices.annual}/year` : ''}.
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            {subscriptionsEnabled ? (
              <>
                {monthlyPriceId && (
                  <SubscribeButton
                    priceId={monthlyPriceId}
                    label={
                      prices.monthly
                        ? `Start free trial — then ${prices.monthly}/month`
                        : 'Start free trial (monthly)'
                    }
                  />
                )}
                {annualPriceId && (
                  <SubscribeButton
                    priceId={annualPriceId}
                    label={
                      prices.annual
                        ? `Start free trial — then ${prices.annual}/year`
                        : 'Start free trial (annual)'
                    }
                  />
                )}
              </>
            ) : (
              <p className="rounded-md border border-border bg-surface px-4 py-3 text-center text-sm text-text-muted">
                Subscriptions are being set up — please check back shortly.
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2.5 text-xs text-text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Secure card entry by Stripe. No charge for {TRIAL_PERIOD_DAYS} days. Cancel anytime
              from your dashboard.
            </span>
          </div>

          <ul className="grid gap-2.5 pt-1">
            {FEATURES.map((label) => (
              <li key={label} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
