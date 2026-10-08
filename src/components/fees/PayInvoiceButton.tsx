'use client'

import { useState, useTransition } from 'react'
import { createInvoicePaymentCheckoutAction } from '@/lib/fees/payment'

/**
 * Parent action: pay a fees invoice online. Starts a Stripe Checkout on the crèche's
 * connected account and redirects. Shows an inline error if the crèche hasn't set up
 * card payments yet (or the charge can't start).
 */
export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const res = await createInvoicePaymentCheckoutAction(invoiceId)
      if ('url' in res) {
        window.location.href = res.url
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Pay now'}
      </button>
      {error && <span className="max-w-[16rem] text-right text-xs text-error">{error}</span>}
    </span>
  )
}
