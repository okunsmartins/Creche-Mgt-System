'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  switchToProSmsAction,
  type SubscriptionCheckoutState,
} from '@/lib/stripe/subscriptionActions'

interface SwitchToSmsButtonProps {
  priceId: string
  label?: string
  /** Visual style — 'primary' for the headline action, 'outline' for a secondary one. */
  variant?: 'primary' | 'outline'
}

/**
 * Upgrades an existing school to the Pro + SMS tier. For a live subscription the
 * action swaps the price in place (no redirect) and returns success → we show a
 * confirmation and refresh so the page re-reads the now-enabled SMS features. For
 * a school with no live subscription it returns a Checkout URL to redirect to.
 */
export function SwitchToSmsButton({
  priceId,
  label = 'Switch to Pro + SMS',
  variant = 'primary',
}: SwitchToSmsButtonProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<SubscriptionCheckoutState, FormData>(
    switchToProSmsAction,
    null,
  )

  useEffect(() => {
    if (state?.url) window.location.href = state.url
  }, [state?.url])

  useEffect(() => {
    if (state?.success) {
      // Give the webhook a moment to reconfirm, then re-read the page state.
      const t = setTimeout(() => router.refresh(), 1500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [state?.success, router])

  const isRedirecting = !!state?.url

  if (state?.success) {
    return (
      <Alert variant="success">
        You&apos;re now on Pro + SMS. Your texting features are being activated — this page will
        refresh in a moment.
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <form action={formAction}>
        <input type="hidden" name="priceId" value={priceId} />
        <Button
          type="submit"
          variant={variant === 'outline' ? 'outline' : 'primary'}
          className="w-full"
          loading={isPending || isRedirecting}
        >
          {!isPending &&
            !isRedirecting &&
            (variant === 'outline' ? (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            ))}
          {label}
        </Button>
      </form>
    </div>
  )
}
