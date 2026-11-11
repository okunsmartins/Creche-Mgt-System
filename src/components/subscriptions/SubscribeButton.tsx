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
  /** Stretch to the container's width (default). Off for inline use, e.g. a banner. */
  fullWidth?: boolean
}

export function SubscribeButton({
  priceId,
  label = 'Subscribe',
  disabled = false,
  fullWidth = true,
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
    <div className={fullWidth ? 'space-y-3' : 'inline-flex flex-col items-center gap-2'}>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <form action={formAction}>
        <input type="hidden" name="priceId" value={priceId} />
        <Button
          type="submit"
          className={fullWidth ? 'w-full' : undefined}
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
