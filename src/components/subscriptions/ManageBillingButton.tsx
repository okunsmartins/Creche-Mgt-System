'use client'

import { useActionState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  createBillingPortalAction,
  type BillingPortalState,
} from '@/lib/stripe/subscriptionActions'

/** Opens the Stripe-hosted billing portal (manage card, cancel, invoices). */
export function ManageBillingButton({ label = 'Manage billing' }: { label?: string }) {
  const [state, formAction, isPending] = useActionState<BillingPortalState, FormData>(
    createBillingPortalAction,
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
        <Button type="submit" variant="outline" loading={isPending || isRedirecting}>
          {!isPending && !isRedirecting && <CreditCard className="h-4 w-4" aria-hidden="true" />}
          {label}
        </Button>
      </form>
    </div>
  )
}
