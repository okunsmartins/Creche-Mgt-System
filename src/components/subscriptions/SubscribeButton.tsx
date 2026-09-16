'use client'

import { useActionState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  createSubscriptionCheckoutAction,
  type SubscriptionCheckoutState,
} from '@/lib/stripe/subscriptionActions'

interface SubscribeButtonProps {
  priceId: string
  label?: string
  /** When true the button is disabled (e.g. no price configured yet). */
  disabled?: boolean
}

export function SubscribeButton({
  priceId,
  label = 'Subscribe',
  disabled = false,
}: SubscribeButtonProps) {
  const [state, formAction, isPending] = useActionState<SubscriptionCheckoutState, FormData>(
    createSubscriptionCheckoutAction,
    null,
  )

  useEffect(() => {
    if (state?.url) window.location.href = state.url
  }, [state?.url])

  const isRedirecting = !!state?.url

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <form action={formAction}>
        <input type="hidden" name="priceId" value={priceId} />
        <Button
          type="submit"
          className="w-full"
          loading={isPending || isRedirecting}
          disabled={disabled}
        >
          {!isPending && !isRedirecting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {label}
        </Button>
      </form>
    </div>
  )
}
