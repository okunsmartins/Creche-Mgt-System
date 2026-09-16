'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { resendEmailAction, type ResendEmailState } from '@/lib/email/actions'

interface ResendEmailButtonProps {
  orderId: string
  type: 'payer_receipt' | 'school_notification'
  label: string
}

export function ResendEmailButton({ orderId, type, label }: ResendEmailButtonProps) {
  const [state, formAction, isPending] = useActionState<ResendEmailState, FormData>(
    resendEmailAction,
    null,
  )

  return (
    <div className="space-y-2">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">Email sent successfully.</Alert>}
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit" variant="outline" size="sm" loading={isPending}>
          {label}
        </Button>
      </form>
    </div>
  )
}
