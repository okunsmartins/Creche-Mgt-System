import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { getSchoolSubscription, hasProAccess } from '@/lib/subscriptions/access'
import { ManageBillingButton } from '@/components/subscriptions/ManageBillingButton'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { SubscriptionStatus } from '@/types/database'

export const metadata: Metadata = { title: 'Subscription | Admin' }

const STATUS_BADGE: Record<
  SubscriptionStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }
> = {
  active: { label: 'Active', variant: 'success' },
  trialing: { label: 'Trial', variant: 'info' },
  past_due: { label: 'Past due', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  incomplete: { label: 'Incomplete', variant: 'default' },
}

export default async function SubscriptionPage() {
  const admin = await requireAdmin()
  const sub = await getSchoolSubscription(admin.schoolId!)
  const isPro = hasProAccess(sub)
  const hasBilling = !!sub?.stripe_customer_id
  const onTrial = isPro && sub?.status === 'trialing'
  const planName = isPro ? 'Creche Wise' : 'Free'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Subscription</h1>
        <p className="mt-1 text-sm text-text-muted">Manage your crèche&apos;s plan and billing.</p>
      </div>

      <div className="card space-y-5 p-6">
        {/* Plan + status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{planName}</p>
            {isPro && (
              <p className="mt-0.5 text-xs font-medium text-primary">
                {onTrial ? 'Free trial — all features, SMS included' : 'All features, SMS included'}
              </p>
            )}
          </div>
          {sub && (
            <Badge variant={STATUS_BADGE[sub.status].variant}>
              {STATUS_BADGE[sub.status].label}
            </Badge>
          )}
        </div>

        {/* Details for an active subscription or an in-progress trial */}
        {sub && isPro && (
          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            {sub.status === 'trialing' && sub.trial_ends_at && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Trial ends</dt>
                <dd className="font-medium text-text-primary">{formatDate(sub.trial_ends_at)}</dd>
              </div>
            )}
            {/* During a trial, current_period_end == trial end, so don't repeat it. */}
            {sub.status !== 'trialing' && sub.current_period_end && (
              <div className="flex justify-between">
                <dt className="text-text-muted">
                  {sub.cancel_at_period_end ? 'Access until' : 'Renews on'}
                </dt>
                <dd className="font-medium text-text-primary">
                  {formatDate(sub.current_period_end)}
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Cancel-at-period-end notice */}
        {sub?.cancel_at_period_end && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your subscription is set to cancel
            {sub.current_period_end
              ? ` on ${formatDate(sub.current_period_end)}`
              : ' at the end of the period'}
            . You can reactivate it from the billing portal.
          </div>
        )}

        {/* Past-due notice */}
        {sub?.status === 'past_due' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your last payment failed. Update your payment method in the billing portal to keep your
            Pro features.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {hasBilling ? (
            <ManageBillingButton />
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
            >
              {isPro ? 'View plans' : 'Upgrade to Pro'}
            </Link>
          )}
          {hasBilling && !isPro && (
            <Link href="/pricing" className="text-sm font-semibold text-primary hover:underline">
              View plans
            </Link>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Billing is handled securely by Stripe. We never store your card details.
      </p>
    </div>
  )
}
