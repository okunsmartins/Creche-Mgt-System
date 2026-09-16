'use client'

import { useActionState } from 'react'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { updatePasswordAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    updatePasswordAction,
    null,
  )

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-xl font-bold text-text-primary">Set a new password</h2>
      <p className="mb-6 text-sm text-text-muted">Choose a strong password for your account.</p>

      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        <PasswordInput
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          hint="Min. 8 characters, one uppercase letter, one number"
          error={state?.fieldErrors?.password}
          disabled={isPending}
        />

        <PasswordInput
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          error={state?.fieldErrors?.confirmPassword}
          disabled={isPending}
        />

        <Button type="submit" className="w-full" loading={isPending}>
          Update password
        </Button>
      </form>
    </div>
  )
}
