'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, X, Loader2, Repeat } from 'lucide-react'
import { useParentBasket } from '@/lib/basket/useParentBasket'
import { createParentOrderAction } from '@/lib/orders/actions'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { OrderActionState } from '@/lib/orders/schemas'

const PRICING_LABEL = {
  per_term: 'per term',
  per_month: 'per month',
  per_session: 'per session',
} as const

export function ParentBasketView() {
  const { items, loaded, removeItem, clearBasket } = useParentBasket()
  const [state, formAction, isPending] = useActionState<OrderActionState, FormData>(
    createParentOrderAction,
    null,
  )
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (state?.orderId) {
      setIsRedirecting(true)
      clearBasket()
      router.push(`/parent/payments/${state.orderId}`)
    }
  }, [state?.orderId, clearBasket, router])

  if (!loaded || isRedirecting) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
        <p className="mt-3 font-medium text-text-secondary">Your basket is empty.</p>
        <p className="mt-1 text-sm text-text-muted">
          Add activities or enrol in programmes to get started.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <Link href="/parent/activities" className="text-sm text-primary hover:underline">
            Browse activities
          </Link>
          <Link href="/parent/programmes" className="text-sm text-primary hover:underline">
            Browse programmes
          </Link>
        </div>
      </div>
    )
  }

  const total = items.reduce((sum, item) => sum + item.amountCents, 0)

  // Serialize basket for the server action — discriminated by kind
  const basketJson = JSON.stringify(
    items.map((item) =>
      item.kind === 'activity'
        ? { kind: 'activity' as const, studentId: item.studentId, activityId: item.activityId }
        : { kind: 'programme' as const, studentId: item.studentId, programmeId: item.programmeId },
    ),
  )

  return (
    <div className="space-y-6">
      <div className="card divide-y divide-border overflow-hidden p-0">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.kind === 'programme' && (
                  <Repeat className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                )}
                <p className="truncate font-medium text-text-primary">
                  {item.kind === 'activity' ? item.activityName : item.programmeName}
                </p>
              </div>
              <p className="text-sm text-text-secondary">
                {item.studentName} — {item.className}
                {item.kind === 'programme' && (
                  <span className="ml-1 text-text-muted">({PRICING_LABEL[item.pricingModel]})</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-text-primary">
                {formatCurrency(item.amountCents)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                aria-label={`Remove ${item.kind === 'activity' ? item.activityName : item.programmeName} for ${item.studentName}`}
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

      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.fieldErrors?.basket && <Alert variant="error">{state.fieldErrors.basket}</Alert>}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="basket" value={basketJson} />
        <Button type="submit" loading={isPending} className="w-full">
          Confirm order
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <Link href="/parent/activities" className="text-text-muted hover:text-primary">
            ← Activities
          </Link>
          <Link href="/parent/programmes" className="text-text-muted hover:text-primary">
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
