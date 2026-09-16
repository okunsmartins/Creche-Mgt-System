'use client'

import { useActionState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  startStripeConnectOnboardingAction,
  type ConnectOnboardingState,
} from '@/lib/stripe/connectActions'

/**
 * Starts/resumes Stripe Connect onboarding and redirects the admin to the
 * Stripe-hosted setup. Used on the payment-setup page.
 */
export function ConnectStripeButton({ label = 'Connect Stripe' }: { label?: string }) {
  const [state, formAction, isPending] = useActionState<ConnectOnboardingState, FormData>(
    startStripeConnectOnboardingAction,
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
        <Button type="submit" loading={isPending || isRedirecting}>
          {!isPending && !isRedirecting && <CreditCard className="h-4 w-4" aria-hidden="true" />}
          {label}
        </Button>
      </form>
    </div>
  )
}
