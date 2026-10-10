import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Mascot } from '@/components/marketing/Mascot'
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
        style={{ background: 'linear-gradient(160deg, #ece4ff 0%, #f5eefe 45%, #fff8ec 100%)' }}
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
        <div className="grid gap-6 pt-[100px] md:grid-cols-2">
          {/* Free trial — no card */}
          <div className="card flex h-full flex-col p-7">
            <h2 className="font-display text-2xl font-bold text-text-primary">
              {TRIAL_PERIOD_DAYS}-day free trial
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Full access to every feature — <strong>no card required</strong> to start.
            </p>
            <p className="mt-4 font-display text-5xl font-bold text-text-primary">
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
              className="mt-auto inline-flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-primary/30 bg-surface px-4 text-sm font-extrabold text-primary transition-colors hover:border-primary"
            >
              Start your free month
            </Link>
          </div>

          {/* The single Creche Wise plan */}
          <div className="relative h-full">
            {/* The laughing Creche Wise teddy peeking over the plan, paws on the edge */}
            <div aria-hidden="true" className="absolute right-6 top-0 z-0 -translate-y-[96px]">
              <Mascot size={132} mood="laugh" />
            </div>
            <div
              aria-hidden="true"
              className="absolute right-6 top-0 z-20 flex w-[132px] -translate-y-[14px] justify-center gap-[46px]"
            >
              <span className="h-6 w-8 rounded-full bg-[#c98a4b] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]" />
              <span className="h-6 w-8 rounded-full bg-[#c98a4b] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]" />
            </div>
            <div className="card relative z-10 flex h-full flex-col border-2 !border-primary/40 p-7 shadow-glow">
              <div className="absolute -top-3.5 left-6 rounded-full bg-secondary px-3.5 py-1 text-xs font-extrabold text-white">
                Everything included
              </div>
              <h2 className="font-display text-2xl font-bold text-text-primary">Creche Wise</h2>
              <p className="mt-1 text-sm text-text-muted">
                Every feature, SMS included — after your free trial.
              </p>
              <p className="mt-4 font-display text-5xl font-bold text-text-primary">
                {prices.monthly ?? '€75'}
                <span className="font-sans text-base font-semibold text-text-muted">
                  /month per crèche
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-text-secondary">
                Unlimited children · Unlimited rooms
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
                          prices.monthly
                            ? `Subscribe — ${prices.monthly}/month`
                            : 'Subscribe monthly'
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
                  <Link
                    href="/get-started"
                    className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#c2255c] via-[#7048e8] to-primary px-4 text-base font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(112,72,232,0.6)] hover:opacity-95"
                  >
                    Start your free month
                  </Link>
                )}
                <p className="text-center text-xs text-text-muted">
                  No card needed to start your trial. Subscribe anytime from your admin portal.
                  Admin sign-in required.
                </p>
              </div>
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
