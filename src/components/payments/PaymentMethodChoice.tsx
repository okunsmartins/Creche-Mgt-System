'use client'

import { CreditCard, Wallet } from 'lucide-react'

export type PaymentMethod = 'card' | 'revolut'

/**
 * Card / Revolut Pay selector. Card is the default. Rendered only when Revolut
 * is configured (the caller gates on that). Purely presentational — the parent
 * owns the selected value and picks the matching server action on submit.
 */
export function PaymentMethodChoice({
  value,
  onChange,
}: {
  value: PaymentMethod
  onChange: (m: PaymentMethod) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
        Payment method
      </legend>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 has-[:checked]:border-primary/50">
        <input
          type="radio"
          name="paymentMethod"
          value="card"
          checked={value === 'card'}
          onChange={() => onChange('card')}
          className="accent-primary"
        />
        <CreditCard className="h-4 w-4 text-text-muted" aria-hidden="true" />
        <span className="text-sm font-medium text-text-primary">Card</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 has-[:checked]:border-primary/50">
        <input
          type="radio"
          name="paymentMethod"
          value="revolut"
          checked={value === 'revolut'}
          onChange={() => onChange('revolut')}
          className="accent-primary"
        />
        <Wallet className="h-4 w-4 text-text-muted" aria-hidden="true" />
        <span className="text-sm font-medium text-text-primary">Revolut Pay</span>
      </label>
    </fieldset>
  )
}
