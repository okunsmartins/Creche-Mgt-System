'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createSchoolAction, type CreateSchoolState } from '@/lib/tenant/actions'

export function CreateSchoolForm() {
  const [state, formAction, isPending] = useActionState<CreateSchoolState, FormData>(
    createSchoolAction,
    null,
  )
  const [subdomain, setSubdomain] = useState('')

  // Mirror the server's normalisation for nicer live feedback.
  const normalise = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '')

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Input
        label="Crèche name"
        name="name"
        type="text"
        placeholder="e.g. Little Explorers Crèche"
        autoComplete="organization"
        required
        error={state?.fieldErrors?.name}
        disabled={isPending}
      />

      <div>
        <Input
          label="Subdomain"
          name="subdomain"
          type="text"
          placeholder="littleexplorers"
          value={subdomain}
          onChange={(e) => setSubdomain(normalise(e.target.value))}
          required
          error={state?.fieldErrors?.subdomain}
          disabled={isPending}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          Your parents will visit{' '}
          <span className="font-mono text-text-secondary">{subdomain || 'yourcreche'}</span>
          <span className="font-mono text-text-muted">.yourdomain.ie</span> — lowercase letters,
          numbers and hyphens only.
        </p>
      </div>

      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <Button
        type="submit"
        className="min-h-[50px] w-full bg-gradient-to-r from-[#c2255c] via-[#7048e8] to-primary text-base font-extrabold shadow-[0_10px_24px_-8px_rgba(112,72,232,0.6)] hover:opacity-95"
        loading={isPending}
      >
        Create my crèche
      </Button>
    </form>
  )
}
