import { unstable_cache } from 'next/cache'
import { logger } from '@/lib/logging'

export type RecurringInterval = 'day' | 'week' | 'month' | 'year'

export interface MrrItem {
  unitAmount: number | null
  interval: RecurringInterval | null
  quantity: number
}

/** Normalize a set of active-subscription line items to monthly cents. Pure. */
export function monthlyCentsFromItems(items: readonly MrrItem[]): number {
  const perMonth = (interval: RecurringInterval | null, amount: number): number => {
    switch (interval) {
      case 'year':
        return amount / 12
      case 'week':
        return (amount * 52) / 12
      case 'day':
        return (amount * 365) / 12
      default:
        return amount // month or unknown → treat as monthly
    }
  }
  const total = items.reduce(
    (sum, i) => sum + (i.unitAmount ? perMonth(i.interval, i.unitAmount) * i.quantity : 0),
    0,
  )
  return Math.round(total)
}

async function computeStripeMrrCents(): Promise<number | null> {
  try {
    // Lazy import so this module (and the pure `monthlyCentsFromItems`) can be
    // imported in tests without triggering Stripe/env validation at load time.
    const { getStripe } = await import('@/lib/stripe/client')
    const stripe = getStripe()
    const items: MrrItem[] = []
    // Auto-paginates. Active subscriptions only — trials/past_due contribute nothing here.
    for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
      for (const item of sub.items.data) {
        const price = item.price
        items.push({
          unitAmount: price?.unit_amount ?? null,
          interval: (price?.recurring?.interval as RecurringInterval | undefined) ?? null,
          quantity: item.quantity ?? 1,
        })
      }
    }
    return monthlyCentsFromItems(items)
  } catch (err) {
    logger.warn('stripe_mrr_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return null
  }
}

/**
 * Exact MRR (cents) summed from Stripe's active subscriptions, normalized to
 * monthly. Cached 5 min so the platform pages don't hit Stripe every render.
 * Returns null if Stripe is unconfigured or the call fails — callers fall back
 * to the local estimate.
 */
export const getStripeMrrCents = unstable_cache(computeStripeMrrCents, ['platform-stripe-mrr'], {
  revalidate: 300,
})
