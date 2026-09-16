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
        label="School name"
        name="name"
        type="text"
        placeholder="e.g. St Mary's National School"
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
          placeholder="stmarys"
          value={subdomain}
          onChange={(e) => setSubdomain(normalise(e.target.value))}
          required
          error={state?.fieldErrors?.subdomain}
          disabled={isPending}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          Your parents will visit{' '}
          <span className="font-mono text-text-secondary">{subdomain || 'yourschool'}</span>
          <span className="font-mono text-text-muted">.yourdomain.ie</span> — lowercase letters,
          numbers and hyphens only.
        </p>
      </div>

      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <Button type="submit" className="w-full" loading={isPending}>
        Create my school
      </Button>
    </form>
  )
}
