'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { forgotPasswordAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    forgotPasswordAction,
    null,
  )

  if (state?.success) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
          <svg
            className="h-6 w-6 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold text-text-primary">Check your email</h2>
        <p className="text-sm text-text-muted">{state.message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-xl font-bold text-text-primary">Reset your password</h2>
      <p className="mb-6 text-sm text-text-muted">
        Enter your email address and we will send you a reset link.
      </p>

      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state?.fieldErrors?.email}
          disabled={isPending}
        />

        <Button type="submit" className="w-full" loading={isPending}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-xs">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
