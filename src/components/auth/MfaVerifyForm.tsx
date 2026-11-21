'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { verifyMfaAction, type MfaCodeState } from '@/lib/auth/mfa-actions'

export function MfaVerifyForm({ next }: { next?: string | undefined }) {
  const [state, formAction, isPending] = useActionState<MfaCodeState, FormData>(
    verifyMfaAction,
    null,
  )
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Input
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
        required
        disabled={isPending}
      />
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <Button type="submit" className="w-full" loading={isPending}>
        Continue
      </Button>
    </form>
  )
}
