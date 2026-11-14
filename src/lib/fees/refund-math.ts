// Pure maths for refunding online fee payments (invoices + late-collection fees).
//
// Refunds are tracked on the payment row (`refunded_amount_cents`, cumulative). After
// any refund the invoice / late fee is re-settled from the NET received across all its
// payments (amount − refunded). Working from absolute totals keeps it retry-safe: the
// admin action and Stripe's `charge.refunded` webhook can both apply the same refund
// and land on the same numbers.

/** Payment statuses that represent money received (possibly part-refunded since). */
export const RECEIVED_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'] as const

export function refundableCents(amountCents: number, refundedCents: number): number {
  return Math.max(0, amountCents - Math.max(0, refundedCents))
}

/** Payment status once `refundedCents` (cumulative) of `amountCents` has been refunded. */
export function paymentStatusAfterRefund(
  amountCents: number,
  refundedCents: number,
): 'paid' | 'partially_refunded' | 'refunded' {
  if (refundedCents <= 0) return 'paid'
  return refundedCents >= amountCents ? 'refunded' : 'partially_refunded'
}

/** Net money kept from a set of payment rows. */
export function netReceivedCents(
  rows: ReadonlyArray<{ amount_cents: number; refunded_amount_cents: number | null }>,
): number {
  return rows.reduce(
    (s, r) => s + Math.max(0, (r.amount_cents ?? 0) - Math.max(0, r.refunded_amount_cents ?? 0)),
    0,
  )
}

/**
 * Invoice state after a refund. Unlike payment settlement this CAN lower the amount paid:
 * a fully refunded invoice goes back to `issued` (still owed) — the crèche voids it if the
 * fee shouldn't stand. Void / draft invoices are left alone.
 */
export function invoiceAfterRefund(
  inv: { netParentCents: number; status: string },
  netReceived: number,
): { amountPaidCents: number; status: string } | null {
  if (inv.status !== 'paid' && inv.status !== 'part_paid' && inv.status !== 'issued') return null
  const net = Math.max(0, inv.netParentCents)
  const amountPaidCents = Math.min(net, Math.max(0, netReceived))
  const status =
    amountPaidCents >= net && net > 0 ? 'paid' : amountPaidCents > 0 ? 'part_paid' : 'issued'
  return { amountPaidCents, status }
}

/** Late-fee state after a refund. */
export function lateFeeAfterRefund(
  feeCents: number,
  netReceived: number,
): { amountPaidCents: number; fullyPaid: boolean } {
  const fee = Math.max(0, feeCents)
  const amountPaidCents = Math.min(fee, Math.max(0, netReceived))
  return { amountPaidCents, fullyPaid: fee > 0 && amountPaidCents >= fee }
}
