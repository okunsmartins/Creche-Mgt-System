import { Lock } from 'lucide-react'
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton'
import type { LockedBanner } from '@/lib/subscriptions/locked-banner'

/**
 * Top-of-/pricing banner for a locked crèche. Names the crèche so its people
 * know they've reached the right place, and gives its admin a Subscribe button
 * without scrolling to the plan card.
 */
export function LockedCrecheBanner({
  banner,
  trialDays,
  priceId,
  priceLabel,
}: {
  banner: LockedBanner
  trialDays: number
  /** The monthly plan's price id; no button without one. */
  priceId: string | undefined
  /** e.g. "€75" (null until Stripe answers). */
  priceLabel: string | null
}) {
  if (banner.kind === 'none') return null

  if (banner.kind === 'generic') {
    return banner.reason === 'start_trial' ? (
      <div className="border-b border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm text-primary">
        Create your portal to <strong>start your {trialDays}-day free trial</strong> — no card
        required, and you can cancel anytime.
      </div>
    ) : (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
        Your crèche&apos;s <strong>{trialDays}-day free trial has ended</strong>. Subscribe below to
        continue using the portal.
      </div>
    )
  }

  const { schoolName, reason } = banner
  const isAdmin = banner.kind === 'admin'
  const status =
    reason === 'start_trial'
      ? `${isAdmin ? 'Your' : 'This'} portal needs a subscription before it can open.`
      : `${isAdmin ? 'Your' : 'This crèche’s'} ${trialDays}-day free trial has ended.`
  const nextStep = isAdmin
    ? 'Subscribe to unlock it for your staff and parents.'
    : 'The portal is paused until the crèche subscribes. Please contact your crèche manager.'

  return (
    <div
      role="status"
      data-testid="locked-creche-banner"
      className="border-b border-amber-200 bg-amber-50 px-4 py-4 text-amber-900"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-start gap-3">
          <Lock className="mt-1 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            {/* The crèche's name, prominent, so its people know they're in the right place. */}
            <p className="font-display text-lg font-bold leading-tight text-amber-950">
              {schoolName}
            </p>
            <p className="mt-0.5 text-sm">
              {status} {nextStep}
            </p>
          </div>
        </div>
        {banner.kind === 'admin' && priceId && (
          <div className="shrink-0">
            <SubscribeButton
              priceId={priceId}
              fullWidth={false}
              label={priceLabel ? `Subscribe — ${priceLabel}/month` : 'Subscribe'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
