'use client'

import { useActionState, useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createParentCheckoutSessionAction } from '@/lib/stripe/actions'
import type { CheckoutSessionState } from '@/lib/stripe/actions'
import { createParentRevolutOrderAction } from '@/lib/revolut/actions'
import type { RevolutOrderState } from '@/lib/revolut/actions'
import { PaymentMethodChoice, type PaymentMethod } from '@/components/payments/PaymentMethodChoice'
import { formatCurrency } from '@/lib/utils'
import {
  INSTALMENT_COUNT,
  isInstalmentEligible,
  nextInstalmentCents,
  instalmentsRemaining,
} from '@/lib/payments/instalments'

// The two provider action states are structurally identical.
type PayState = CheckoutSessionState & RevolutOrderState

interface PayNowFormProps {
  orderId: string
  totalCents: number
  amountPaidCents: number
  /** Whether the school's plan allows paying in instalments (Pro feature). */
  instalmentsEnabled?: boolean
  /** Whether Revolut Pay is configured — shows the Card/Revolut selector. */
  revolutEnabled?: boolean
}

export function PayNowForm({
  orderId,
  totalCents,
  amountPaidCents,
  instalmentsEnabled = false,
  revolutEnabled = false,
}: PayNowFormProps) {
  const remainingCents = totalCents - amountPaidCents

  // Instalments: a min-€20 order split into 4 equal parts. Offered only when the
  // school is on Pro AND the order qualifies AND there is still a balance.
  const nextInstalment = nextInstalmentCents(totalCents, amountPaidCents)
  const instalmentsLeft = instalmentsRemaining(totalCents, amountPaidCents)
  const instalmentEligible =
    instalmentsEnabled &&
    isInstalmentEligible(totalCents) &&
    remainingCents > 0 &&
    nextInstalment > 0 &&
    nextInstalment < remainingCents

  const [paymentMode, setPaymentMode] = useState<'full' | 'instalment'>('full')
  const [method, setMethod] = useState<PaymentMethod>('card')

  const [stripeState, stripeFormAction, stripePending] = useActionState<PayState, FormData>(
    createParentCheckoutSessionAction,
    null,
  )
  const [revolutState, revolutFormAction, revolutPending] = useActionState<PayState, FormData>(
    createParentRevolutOrderAction,
    null,
  )

  // Instalments are supported on both the Card (Stripe) and Revolut paths — the
  // charged amount is computed server-side from the same shared schedule.
  const usingRevolut = revolutEnabled && method === 'revolut'
  const state = usingRevolut ? revolutState : stripeState
  const isPending = usingRevolut ? revolutPending : stripePending

  useEffect(() => {
    if (state?.url) window.location.href = state.url
  }, [state?.url])

  const isRedirecting = !!state?.url
  const payingInstalment = instalmentEligible && paymentMode === 'instalment'

  return (
    <div className="space-y-4">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {revolutEnabled && <PaymentMethodChoice value={method} onChange={setMethod} />}

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="radio"
            name="paymentMode"
            value="full"
            checked={paymentMode === 'full'}
            onChange={() => setPaymentMode('full')}
            className="accent-primary"
          />
          <span className="text-sm font-medium text-text-primary">
            Pay in full — {formatCurrency(remainingCents)}
          </span>
        </label>

        {instalmentEligible && (
          <>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="paymentMode"
                value="instalment"
                checked={paymentMode === 'instalment'}
                onChange={() => setPaymentMode('instalment')}
                className="accent-primary"
              />
              <span className="text-sm font-medium text-text-primary">
                Pay in {INSTALMENT_COUNT} instalments
              </span>
            </label>

            {payingInstalment && (
              <p className="ml-7 text-xs text-text-muted">
                Pay {formatCurrency(nextInstalment)} now.{' '}
                {instalmentsLeft > 1
                  ? `${instalmentsLeft - 1} further instalment${instalmentsLeft - 1 === 1 ? '' : 's'} (${formatCurrency(remainingCents - nextInstalment)} total) due later.`
                  : 'This clears your balance.'}
              </p>
            )}
          </>
        )}
      </div>

      <form action={usingRevolut ? revolutFormAction : stripeFormAction}>
        <input type="hidden" name="orderId" value={orderId} />
        {payingInstalment && <input type="hidden" name="payInstalment" value="true" />}
        <Button type="submit" loading={isPending || isRedirecting} className="w-full">
          {!isPending && !isRedirecting && <CreditCard className="h-4 w-4" aria-hidden="true" />}
          {payingInstalment ? `Pay ${formatCurrency(nextInstalment)} now` : 'Pay now'}
        </Button>
      </form>

      <p className="text-center text-xs text-text-muted">
        You will be redirected to {usingRevolut ? 'Revolut' : 'Stripe'}&apos;s secure payment page.
      </p>
    </div>
  )
}
