import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { serverEnv } from '@/lib/env'
import { getProPrices } from '@/lib/stripe/prices'
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'

export const metadata: Metadata = { title: 'Pricing' }

// Everything a crèche gets — one plan unlocks it all. The no-card free trial grants
// full access from day one, so this same list applies during the trial. There is no
// reduced tier and no separate SMS add-on: texting is included.
const FEATURES: string[] = [
  'Text parents (SMS) — 500 texts/month included',
  'Online payment collection (activities, trips, books)',
  'Guest & parent payments',
  'Child management, rooms & daily check-in',
  'Fees, invoices & NCS subvention',
  'School collection & authorised collectors',
  'Payment links & instalments',
  'CSV import',
  'Advanced reports & analytics',
  'Email receipts & reminders',
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
          Create your portal to <strong>start your {TRIAL_PERIOD_DAYS}-day free trial</strong> — no
          card required, and you can cancel anytime.
        </div>
      )}
      {reason === 'trial_ended' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Your crèche&apos;s <strong>{TRIAL_PERIOD_DAYS}-day free trial has ended</strong>.
          Subscribe below to continue using the portal.
        </div>
      )}
      {locked && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          Your <strong>free trial has ended</strong>. Subscribe below to unlock it for your crèche.
        </div>
      )}
      {/* Hero */}
      <section
        className="py-16 text-text-primary md:py-20"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Plans &amp; pricing
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            One simple price for <span className="text-primary">your crèche</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Every feature, SMS included — one plan. Try it free for {TRIAL_PERIOD_DAYS} days,{' '}
            <strong>no card required</strong>. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free trial — no card */}
          <div className="card flex flex-col p-6">
            <h2 className="text-lg font-semibold text-text-primary">
              {TRIAL_PERIOD_DAYS}-day free trial
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Full access to every feature — <strong>no card required</strong> to start.
            </p>
            <p className="mt-4 text-3xl font-bold text-text-primary">
              €0
              <span className="text-base font-normal text-text-muted">
                {' '}
                for {TRIAL_PERIOD_DAYS} days
              </span>
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Add your details after the trial to keep your portal.
            </p>
            <Link
              href="/get-started"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary/40 hover:bg-surface-raised"
            >
              Create your portal
            </Link>
          </div>

          {/* The single Creche Wise plan */}
          <div className="card relative flex flex-col border-primary/40 p-6 shadow-glow">
            <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
              Everything included
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Creche Wise</h2>
            <p className="mt-1 text-sm text-text-muted">
              Every feature, SMS included — after your free trial.
            </p>
            <p className="mt-4 text-3xl font-bold text-text-primary">
              {prices.monthly ?? '€—'}
              <span className="text-base font-normal text-text-muted">/month</span>
            </p>
            {prices.annual && (
              <p className="mt-1 text-sm text-text-muted">
                or {prices.annual}/year —{' '}
                <span className="font-semibold text-primary">save 10%</span>
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
                No card needed to start your trial. Subscribe anytime from your admin portal. Admin
                sign-in required.
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
            One plan unlocks everything below — free during your {TRIAL_PERIOD_DAYS}-day trial, then
            on your subscription.
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
