'use client'

import { useActionState } from 'react'
import { MailCheck, ArrowRight, Mail, User, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { requestPortalSignupAction, type RequestPortalState } from '@/lib/onboarding/actions'

export function RequestPortalForm() {
  const [state, formAction, isPending] = useActionState<RequestPortalState, FormData>(
    requestPortalSignupAction,
    {},
  )

  if (state.success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Check your inbox</h2>
        <p className="mt-1 text-sm text-text-secondary">
          We&apos;ve sent a confirmation link to your email. Click it to confirm your address, then
          you can create your portal. The link may take a minute to arrive — check spam if you
          don&apos;t see it.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Input
        name="email"
        type="email"
        label="Your email"
        required
        autoComplete="email"
        placeholder="you@yourcreche.ie"
        leftIcon={<Mail className="h-4 w-4" />}
      />
      <Input
        name="contactName"
        label="Your name (optional)"
        autoComplete="name"
        maxLength={120}
        leftIcon={<User className="h-4 w-4" />}
      />
      <Input
        name="schoolName"
        label="Crèche name (optional)"
        maxLength={160}
        leftIcon={<Building2 className="h-4 w-4" />}
      />

      <Button
        type="submit"
        loading={isPending}
        disabled={isPending}
        className="min-h-[50px] w-full bg-gradient-to-r from-[#c2255c] via-[#7048e8] to-primary text-base font-extrabold shadow-[0_10px_24px_-8px_rgba(112,72,232,0.6)] hover:opacity-95"
      >
        Send confirmation link
        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </Button>
      <p className="text-center text-xs text-text-muted">
        We&apos;ll email you a link to confirm this address before you set up your portal.
      </p>
    </form>
  )
}
