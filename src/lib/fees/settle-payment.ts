// Pure settlement maths for online fee payments (invoices + late-collection fees).
//
// The webhook records every successful payment as its own `payments` row FIRST
// (unique per checkout session / provider order, so a retried webhook can't add
// it twice), then settles the subject from the TOTAL of its payment rows. Working
// from the total — instead of "current paid + this payment" — means a retry can
// never double-count, and anything received beyond what was owed is reported as
// an excess the crèche must refund (e.g. a parent paid twice, or paid an invoice
// the crèche had just voided).

/** Invoice statuses that can still take a payment. */
export const PAYABLE_INVOICE_STATUSES = ['issued', 'part_paid'] as const

export interface InvoiceSettlement {
  /** What `invoices.amount_paid_cents` should be — never more than the amount owed. */
  amountPaidCents: number
  /** What `invoices.status` should be. */
  status: string
  /** Money received beyond what was owed (to refund). 0 when nothing extra was paid. */
  excessCents: number
  /** True when the invoice row needs updating. */
  changed: boolean
}

/**
 * Settle an invoice from the total received for it.
 * - issued / part_paid: paid up to the net amount; the rest is excess.
 * - paid: stays paid; anything beyond the net amount is excess.
 * - void / draft (or anything else): never changed; everything received is excess,
 *   because nothing is owed on it.
 */
export function settleInvoice(
  inv: { netParentCents: number; amountPaidCents: number; status: string },
  totalReceivedCents: number,
): InvoiceSettlement {
  const received = Math.max(0, Math.round(totalReceivedCents))
  const net = Math.max(0, inv.netParentCents)

  if (inv.status !== 'issued' && inv.status !== 'part_paid' && inv.status !== 'paid') {
    return {
      amountPaidCents: inv.amountPaidCents,
      status: inv.status,
      excessCents: received,
      changed: false,
    }
  }

  // Never lower what's already recorded (e.g. a legacy row paid before payments existed).
  const amountPaidCents = Math.min(net, Math.max(received, inv.amountPaidCents))
  const excessCents = Math.max(0, received - net)

  if (inv.status === 'paid') {
    return { amountPaidCents: inv.amountPaidCents, status: 'paid', excessCents, changed: false }
  }

  const status = amountPaidCents >= net ? 'paid' : amountPaidCents > 0 ? 'part_paid' : inv.status
  return {
    amountPaidCents,
    status,
    excessCents,
    changed: amountPaidCents !== inv.amountPaidCents || status !== inv.status,
  }
}

export interface LateFeeSettlement {
  amountPaidCents: number
  fullyPaid: boolean
  excessCents: number
  changed: boolean
}

/** Settle a late-collection fee from the total received for it. */
export function settleLateFee(
  lc: { feeCents: number; amountPaidCents: number },
  totalReceivedCents: number,
): LateFeeSettlement {
  const received = Math.max(0, Math.round(totalReceivedCents))
  const fee = Math.max(0, lc.feeCents)
  const amountPaidCents = Math.min(fee, Math.max(received, lc.amountPaidCents))
  return {
    amountPaidCents,
    fullyPaid: amountPaidCents >= fee,
    excessCents: Math.max(0, received - fee),
    changed: amountPaidCents !== lc.amountPaidCents,
  }
}
