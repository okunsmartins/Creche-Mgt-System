'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, Repeat, X, Loader2 } from 'lucide-react'
import { useGuestBasket } from '@/lib/basket/useGuestBasket'
import { createGuestCodeOrderAction, createGuestManualOrderAction } from '@/lib/orders/actions'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import type { OrderActionState } from '@/lib/orders/schemas'

const PRICING_MODEL_LABELS: Record<string, string> = {
  per_term: 'Per term',
  per_month: 'Per month',
  per_session: 'Per session',
}

export function GuestBasketView() {
  const { basket, loaded, removeActivity, removeProgramme, clearBasket } = useGuestBasket()

  const [codeState, codeFormAction, isCodePending] = useActionState<OrderActionState, FormData>(
    createGuestCodeOrderAction,
    null,
  )
  const [manualState, manualFormAction, isManualPending] = useActionState<
    OrderActionState,
    FormData
  >(createGuestManualOrderAction, null)

  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()

  const successOrderId = codeState?.orderId ?? manualState?.orderId

  useEffect(() => {
    if (successOrderId) {
      setIsRedirecting(true)
      clearBasket()
      router.push(`/guest-payment/confirmation/${successOrderId}`)
    }
  }, [successOrderId, clearBasket, router])

  if (!loaded || isRedirecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
      </div>
    )
  }

  const isEmpty = !basket || (basket.activities.length === 0 && basket.programmes.length === 0)

  if (isEmpty) {
    return (
      <div className="py-16 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
        <p className="mt-3 font-medium text-text-secondary">Your basket is empty.</p>
        <div className="mt-4 flex justify-center gap-4">
          <Link href="/activities" className="text-sm text-primary hover:underline">
            Browse activities
          </Link>
          <Link href="/programmes" className="text-sm text-primary hover:underline">
            Browse programmes
          </Link>
        </div>
      </div>
    )
  }

  const activityTotal = basket.activities.reduce((sum, a) => sum + a.amountCents, 0)
  const programmeTotal = basket.programmes.reduce((sum, p) => sum + p.amountCents, 0)
  const total = activityTotal + programmeTotal

  const basketJson = JSON.stringify([
    ...basket.activities.map((a) => ({ kind: 'activity', activityId: a.activityId })),
    ...basket.programmes.map((p) => ({ kind: 'programme', programmeId: p.programmeId })),
  ])

  const isCode = basket.mode === 'code'
  const state = isCode ? codeState : manualState
  const formAction = isCode ? codeFormAction : manualFormAction
  const isPending = isCodePending || isManualPending

  const childDisplay = isCode
    ? `${basket.lookupFirstName} — ${basket.lookupClassName} (code verified)`
    : `${basket.childFirstName} ${basket.childLastName} — ${basket.childClassName} (manual entry)`

  return (
    <div className="space-y-6">
      {/* Child info */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-text-muted">Paying for child</p>
        <p className="mt-0.5 font-medium text-text-primary">{childDisplay}</p>
        <button
          type="button"
          onClick={clearBasket}
          className="mt-1 text-xs text-text-muted underline hover:text-text-primary"
        >
          Start over
        </button>
      </div>

      {/* Item list */}
      <div className="card divide-y divide-border overflow-hidden p-0">
        {basket.activities.map((activity) => (
          <div key={activity.activityId} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-text-primary">{activity.activityName}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-text-primary">
                {formatCurrency(activity.amountCents)}
              </span>
              <button
                type="button"
                onClick={() => removeActivity(activity.activityId)}
                aria-label={`Remove ${activity.activityName}`}
                className="text-text-muted transition-colors hover:text-error"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {basket.programmes.map((programme) => (
          <div key={programme.programmeId} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <p className="truncate font-medium text-text-primary">{programme.programmeName}</p>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {PRICING_MODEL_LABELS[programme.pricingModel] ?? programme.pricingModel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-text-primary">
                {formatCurrency(programme.amountCents)}
              </span>
              <button
                type="button"
                onClick={() => removeProgramme(programme.programmeId)}
                aria-label={`Remove ${programme.programmeName}`}
                className="text-text-muted transition-colors hover:text-error"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-between bg-surface p-4">
          <span className="font-semibold text-text-primary">Total</span>
          <span className="font-bold text-text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Payer details + confirm form */}
      <form action={formAction} className="space-y-4">
        {/* Hidden: child identification */}
        {isCode ? (
          <input type="hidden" name="pupilCode" value={basket.pupilCode} />
        ) : (
          <>
            <input type="hidden" name="childFirstName" value={basket.childFirstName} />
            <input type="hidden" name="childLastName" value={basket.childLastName} />
            <input type="hidden" name="childClassId" value={basket.childClassId} />
          </>
        )}
        {/* Hidden: mixed basket JSON */}
        <input type="hidden" name="basket" value={basketJson} />
        {/* Hidden: payment link attribution (optional) */}
        {basket.paymentLinkId && (
          <input type="hidden" name="paymentLinkId" value={basket.paymentLinkId} />
        )}

        {state?.error && <Alert variant="error">{state.error}</Alert>}
        {state?.fieldErrors?.basket && <Alert variant="error">{state.fieldErrors.basket}</Alert>}
        {!!(
          state?.fieldErrors?.pupilCode ??
          state?.fieldErrors?.childFirstName ??
          state?.fieldErrors?.childLastName ??
          state?.fieldErrors?.childClassId
        ) && (
          <Alert variant="error">
            Your basket contains invalid data. Please clear your basket and start over.
          </Alert>
        )}

        <Input
          label="Your name"
          name="payerName"
          required
          autoComplete="name"
          error={state?.fieldErrors?.payerName}
          disabled={isPending}
        />
        <Input
          label="Your email address"
          name="payerEmail"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          hint="Your receipt will be sent to this address."
          error={state?.fieldErrors?.payerEmail}
          disabled={isPending}
        />

        <Button type="submit" loading={isPending} className="w-full">
          Confirm order
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <Link href="/activities" className="text-text-muted hover:text-primary">
            ← Activities
          </Link>
          <Link href="/programmes" className="text-text-muted hover:text-primary">
            ← Programmes
          </Link>
        </div>
        <button type="button" onClick={clearBasket} className="text-sm text-error hover:underline">
          Clear basket
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Prices are confirmed server-side at the time of order creation.
      </p>
    </div>
  )
}
