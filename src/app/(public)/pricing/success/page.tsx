import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'

export const metadata: Metadata = { title: 'Subscription activating' }

// Always re-check on load — the plan flips to active via the Stripe webhook,
// which normally lands before the browser gets back here.
export const dynamic = 'force-dynamic'

/**
 * Post-checkout landing. The browser redirect is NOT authoritative — the plan is
 * only active once the Stripe webhook is processed. So: if the webhook has
 * already landed (the normal case, ~1s), send the admin straight to the
 * dashboard. Otherwise show a brief "activating" notice rather than bouncing
 * them into the trial-ended gate.
 */
export default async function SubscriptionSuccessPage() {
  const admin = await requireAdmin()

  if (admin.schoolId && (await schoolHasProAccess(admin.schoolId))) {
    redirect('/admin/dashboard')
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <CheckCircle className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-text-primary">
        Thank you — your subscription is activating
      </h1>
      <p className="mt-3 text-sm text-text-secondary">
        Stripe has confirmed your payment. Your Pro access is being enabled and usually takes only a
        few seconds — refresh this page, or head to your dashboard.
      </p>
      <div className="mt-8 flex justify-center">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
