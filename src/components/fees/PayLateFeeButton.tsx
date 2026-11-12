'use client'

import { createLateFeePaymentCheckoutAction } from '@/lib/fees/payment'
import { FeePayButtons, type FeePayOptions } from './FeePayButtons'

/**
 * Parent action: pay a late-collection fee online — by card and/or with Revolut,
 * whichever the crèche has connected. Money goes to the crèche's own account.
 */
export function PayLateFeeButton({
  lateFeeId,
  options = { card: true, revolut: false },
}: {
  lateFeeId: string
  options?: FeePayOptions
}) {
  return (
    <FeePayButtons
      options={options}
      start={(method) => createLateFeePaymentCheckoutAction(lateFeeId, method)}
    />
  )
}
