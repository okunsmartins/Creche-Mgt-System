import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { serverEnv } from '@/lib/env'
import { getProPrices } from '@/lib/stripe/prices'
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'

export const metadata: Metadata = { title: 'Pricing' }

// Everything a school gets on Pro. The card-at-signup free trial (started via
// Stripe Checkout at onboarding) is a FULL Pro trial, so this same list applies
// during the trial — there is no reduced free tier.
const FEATURES: string[] = [
  'Online payment collection (activities, trips, books)',
  'Guest & parent payments',
  'Pupil management & class lists',
  'Email receipts',
  'Payment links',
  'Instalment payments',
  'CSV import',
  'Advanced reports & analytics',
]

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; reason?: string }>
}) {
  const { locked, reason } = await searchParams
  const monthlyPriceId = serverEnv.stripeProMonthlyPriceId
  const annualPriceId = serverEnv.stripeProAnnualPriceId
  const subscriptionsEnabled = !!(monthlyPriceId || annualPriceId)
  const prices = subscriptionsEnabled ? await getProPrices() : { monthly: null, annual: null }

  return (
    <>
      {reason === 'start_trial' && (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm text-primary">
          Add a card below to <strong>start your {TRIAL_PERIOD_DAYS}-day free trial</strong> — you
          won&apos;t be charged until it ends, and you can cancel anytime.
        </div>
      )}
      {reason === 'trial_ended' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Your school&apos;s <strong>{TRIAL_PERIOD_DAYS}-day free trial has ended</strong>.
          Subscribe to Pro below to continue using the portal.
        </div>
      )}
      {locked && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          That&apos;s a <strong>Pro</strong> feature. Subscribe below to unlock it for your school.
        </div>
      )}
      {/* Hero */}
      <section
        className="py-16 text-text-primary md:py-20"
        style={{ background: 'radial-gradient(ellipse at top, #ece6fc 0%, #f3f0fb 62%)' }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Plans &amp; pricing
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple pricing for <span className="text-primary">your school</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Try every feature free for {TRIAL_PERIOD_DAYS} days. Add a card to start — you
            won&apos;t be charged until the trial ends, and you can cancel anytime.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free trial */}
          <div className="card flex flex-col p-6">
            <h2 className="text-lg font-semibold text-text-primary">
              {TRIAL_PERIOD_DAYS}-day free trial
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Full access to every feature. Card required to start — no charge for{' '}
              {TRIAL_PERIOD_DAYS} days.
            </p>
            <p className="mt-4 text-3xl font-bold text-text-primary">
              €0
              <span className="text-base font-normal text-text-muted">
                {' '}
                for {TRIAL_PERIOD_DAYS} days
              </span>
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Then {prices.monthly ?? 'Pro'}/month to keep your portal.
            </p>
            <Link
              href="/get-started"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary/40 hover:bg-surface-raised"
            >
              Create your portal
            </Link>
          </div>

          {/* Pro */}
          <div className="card relative flex flex-col border-primary/40 p-6 shadow-glow">
            <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
              Most popular
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Pro</h2>
            <p className="mt-1 text-sm text-text-muted">
              Everything your school office needs, after your trial.
            </p>
            <p className="mt-4 text-3xl font-bold text-text-primary">
              {prices.monthly ?? '€—'}
              <span className="text-base font-normal text-text-muted">/month</span>
            </p>
            {prices.annual && (
              <p className="mt-1 text-sm text-text-muted">
                or {prices.annual}/year — save vs. paying monthly
              </p>
            )}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              ✓ Cancel anytime — no lock-in
            </p>

            <div className="mt-6 space-y-3">
              {subscriptionsEnabled ? (
                <>
                  {monthlyPriceId && (
                    <SubscribeButton
                      priceId={monthlyPriceId}
                      label={
                        prices.monthly ? `Subscribe — ${prices.monthly}/month` : 'Subscribe monthly'
                      }
                    />
                  )}
                  {annualPriceId && (
                    <SubscribeButton
                      priceId={annualPriceId}
                      label={
                        prices.annual ? `Subscribe — ${prices.annual}/year` : 'Subscribe annually'
                      }
                    />
                  )}
                </>
              ) : (
                <p className="rounded-md border border-border bg-surface px-4 py-3 text-center text-sm text-text-muted">
                  Subscriptions are being set up — check back soon.
                </p>
              )}
              <p className="text-center text-xs text-text-muted">
                Card required. Billing starts today if your {TRIAL_PERIOD_DAYS}-day free trial has
                already ended. Admin sign-in required.
              </p>
            </div>
          </div>
        </div>

        {/* What's included — same on the trial and on Pro */}
        <div className="mt-12">
          <h2 className="text-center text-lg font-semibold text-text-primary">
            Everything included
          </h2>
          <p className="mt-1 text-center text-sm text-text-muted">
            Every feature below is available during your {TRIAL_PERIOD_DAYS}-day free trial and on
            Pro.
          </p>
          <ul className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
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
