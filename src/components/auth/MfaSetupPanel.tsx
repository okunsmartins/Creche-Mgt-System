'use client'

import { useActionState, useState, useTransition } from 'react'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import {
  confirmMfaEnrollmentAction,
  startMfaEnrollmentAction,
  type MfaCodeState,
  type MfaEnrollState,
} from '@/lib/auth/mfa-actions'

/** Two steps: show a QR code for the authenticator app, then confirm with its first code. */
export function MfaSetupPanel() {
  const [enroll, setEnroll] = useState<MfaEnrollState>(null)
  const [starting, startTransition] = useTransition()
  const [state, formAction, isPending] = useActionState<MfaCodeState, FormData>(
    confirmMfaEnrollmentAction,
    null,
  )
  const ready = enroll && 'factorId' in enroll

  if (!ready) {
    return (
      <div className="space-y-4">
        <ol className="space-y-2 text-sm text-text-secondary">
          <li className="flex gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Install an authenticator app on your phone, such as Google Authenticator or Microsoft
            Authenticator (free).
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Then press the button below and scan the code it shows.
          </li>
        </ol>
        {enroll && 'error' in enroll && <Alert variant="error">{enroll.error}</Alert>}
        <Button
          type="button"
          className="w-full"
          loading={starting}
          onClick={() => startTransition(async () => setEnroll(await startMfaEnrollmentAction()))}
        >
          Show my set-up code
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        In your authenticator app, tap <strong>+</strong> and scan this code:
      </p>
      <div className="flex justify-center rounded-xl border border-border bg-white p-4">
        {/* Supabase returns the QR as an SVG data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enroll.qrCode} alt="QR code for your authenticator app" className="h-48 w-48" />
      </div>
      <details className="text-xs text-text-muted">
        <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
        <code className="mt-2 block break-all rounded-md bg-surface-raised p-2 font-mono text-text-primary">
          {enroll.secret}
        </code>
      </details>
      <form action={formAction} className="space-y-3" noValidate>
        <input type="hidden" name="factorId" value={enroll.factorId} />
        <Input
          label="6-digit code from the app"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          disabled={isPending}
        />
        {state?.error && <Alert variant="error">{state.error}</Alert>}
        <Button type="submit" className="w-full" loading={isPending}>
          Turn on two-step sign-in
        </Button>
      </form>
    </div>
  )
}
