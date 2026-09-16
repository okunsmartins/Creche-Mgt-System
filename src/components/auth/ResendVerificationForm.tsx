'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { resendVerificationAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

export function ResendVerificationForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    resendVerificationAction,
    null,
  )

  if (state?.success) {
    return (
      <Alert variant="success" className="mt-6">
        {state.message}
      </Alert>
    )
  }

  return (
    <form action={formAction} className="mt-6 space-y-3" noValidate>
      <p className="text-center text-xs text-text-muted">
        Didn&apos;t receive it? Enter your email to resend.
      </p>
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state?.fieldErrors?.email}
        disabled={isPending}
      />
      {state?.error && (
        <Alert variant="error" className="text-xs">
          {state.error}
        </Alert>
      )}
      <Button type="submit" variant="outline" size="sm" className="w-full" loading={isPending}>
        Resend verification email
      </Button>
    </form>
  )
}
