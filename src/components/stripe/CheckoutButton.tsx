'use client'

import { useActionState, useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { CheckoutSessionState } from '@/lib/stripe/actions'
import type { RevolutOrderState } from '@/lib/revolut/actions'
import { PaymentMethodChoice, type PaymentMethod } from '@/components/payments/PaymentMethodChoice'

// The two provider action states are structurally identical.
type PayState = CheckoutSessionState & RevolutOrderState

interface CheckoutButtonProps {
  orderId: string
  action: (prev: CheckoutSessionState, formData: FormData) => Promise<CheckoutSessionState>
  /** When provided AND Revolut is configured, a Card/Revolut selector is shown. */
  revolutAction?: (prev: RevolutOrderState, formData: FormData) => Promise<RevolutOrderState>
  revolutEnabled?: boolean
}

export function CheckoutButton({
  orderId,
  action,
  revolutAction,
  revolutEnabled = false,
}: CheckoutButtonProps) {
  const showChoice = revolutEnabled && !!revolutAction
  const [method, setMethod] = useState<PaymentMethod>('card')

  const [stripeState, stripeFormAction, stripePending] = useActionState<PayState, FormData>(
    action,
    null,
  )
  const [revolutState, revolutFormAction, revolutPending] = useActionState<PayState, FormData>(
    revolutAction ?? action,
    null,
  )

  const usingRevolut = showChoice && method === 'revolut'
  const state = usingRevolut ? revolutState : stripeState
  const isPending = usingRevolut ? revolutPending : stripePending

  useEffect(() => {
    if (state?.url) window.location.href = state.url
  }, [state?.url])

  const isRedirecting = !!state?.url

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {showChoice && <PaymentMethodChoice value={method} onChange={setMethod} />}

      <form action={usingRevolut ? revolutFormAction : stripeFormAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" loading={isPending || isRedirecting} className="w-full">
          {!isPending && !isRedirecting && <CreditCard className="h-4 w-4" aria-hidden="true" />}
          Pay now
        </Button>
      </form>
      <p className="text-center text-xs text-text-muted">
        You will be redirected to {usingRevolut ? 'Revolut' : 'Stripe'}&apos;s secure payment page.
      </p>
    </div>
  )
}
