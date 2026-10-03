import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Check, ShieldCheck } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { getProPrices } from '@/lib/stripe/prices'
import { serverEnv } from '@/lib/env'
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton'

export const metadata: Metadata = { title: 'Subscribe' }

// Access flips via the Stripe webhook after checkout, so always re-check on load
// rather than caching.
export const dynamic = 'force-dynamic'

const FEATURES: string[] = [
  'Text parents (SMS) — 500 texts/month included',
  'Online payment collection (activities, trips, books)',
  'Guest & parent payments',
  'Child management, rooms & daily check-in',
  'Fees, invoices & NCS subvention',
  'Payment links & instalments',
  'Advanced reports & analytics',
]

/**
 * Subscribe step. New crèches get a no-card free trial at signup and go straight to
 * the dashboard, so this page is normally reached only once that trial has ended (or
 * a subscription lapsed). It opens Stripe Checkout for the single Creche Wise plan.
 * If the crèche already has access (trial still running, or the webhook already
 * landed after checkout), it skips straight to the app.
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
            Subscribe to <span className="text-primary">Creche Wise</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Your free trial has ended. Subscribe to keep your crèche portal — every feature, SMS
            included. Cancel anytime.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="card space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Creche Wise</h2>
            <p className="mt-1 text-sm text-text-muted">
              Everything your crèche needs — SMS included. Cancel anytime.
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
          </div>

          <div className="space-y-3 border-t border-border pt-4">
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
                Subscriptions are being set up — please check back shortly.
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2.5 text-xs text-text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Secure card entry by Stripe. Cancel anytime from your dashboard.</span>
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
