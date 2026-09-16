'use client'

import { useActionState } from 'react'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { changePasswordAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    changePasswordAction,
    null,
  )

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <PasswordInput
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with an uppercase letter and a number."
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
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <Button type="submit" className="w-full" loading={isPending}>
        Set new password
      </Button>
    </form>
  )
}
