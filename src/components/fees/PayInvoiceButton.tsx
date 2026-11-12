'use client'

import { createInvoicePaymentCheckoutAction } from '@/lib/fees/payment'
import { FeePayButtons, type FeePayOptions } from './FeePayButtons'

/**
 * Parent action: pay a fees invoice online — by card (the crèche's Stripe account)
 * and/or with Revolut (the crèche's own Revolut account), whichever it has connected.
 */
export function PayInvoiceButton({
  invoiceId,
  options = { card: true, revolut: false },
}: {
  invoiceId: string
  options?: FeePayOptions
}) {
  return (
    <FeePayButtons
      options={options}
      start={(method) => createInvoicePaymentCheckoutAction(invoiceId, method)}
    />
  )
}
