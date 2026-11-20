// One audit row per real refund, whichever path sees it first.
//
// A fee refund can be seen twice: by the admin refund action (which knows its Stripe
// refund id) and by the Stripe `charge.refunded` webhook (which can arrive first, or be
// retried). A double-submit with the same idempotency key also returns the SAME Stripe
// refund twice. Each refund is therefore audited under its provider refund id, at most
// once, and the webhook only audits refunds the app didn't make (Stripe dashboard).

/** Minimal shape of a Stripe Refund we need. */
export interface ProviderRefund {
  id: string
  amount: number
  status: string | null
  metadata?: Record<string, string> | null
}

/**
 * Refunds the WEBHOOK should audit: succeeded, not made by the app (the app tags its
 * refunds with `metadata.fee_payment_id` and audits them itself), and not audited yet.
 */
export function refundsToAuditFromWebhook(
  refunds: ProviderRefund[],
  alreadyAudited: ReadonlySet<string>,
): ProviderRefund[] {
  return refunds.filter(
    (r) =>
      (r.status === 'succeeded' || r.status === 'pending') &&
      !r.metadata?.fee_payment_id &&
      !alreadyAudited.has(r.id),
  )
}

/** Keep the first row per provider refund id (rows without an id are all kept). */
export function dedupeByRefundId<T>(rows: T[], idOf: (row: T) => string | null): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const id = idOf(row)
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
