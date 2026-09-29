'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { signUpAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

export function RegisterForm({
  next,
  tenantSlug,
}: {
  next?: string | undefined
  /** School slug when registering within a crèche's context (`/s/<slug>/register`). */
  tenantSlug?: string | undefined
}) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    null,
  )

  // Someone sent here from "Create your own portal" is setting up a crèche, not
  // paying for a child — the default parent copy would read as the wrong product.
  const isCreatingPortal = next === '/onboarding'

  // Preserve the crèche context on the "Sign in" link (see LoginForm).
  const withTenant = (href: string) => (tenantSlug ? `/s/${tenantSlug}${href}` : href)

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-xl font-bold text-text-primary">
        {isCreatingPortal ? 'Create your account' : 'Create an account'}
      </h2>
      <p className="mb-6 text-sm text-text-muted">
        {isCreatingPortal
          ? "First, create your account — then you'll set up your crèche portal."
          : 'Register to manage school payments for your children.'}
      </p>

      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            error={state?.fieldErrors?.firstName}
            disabled={isPending}
          />
          <Input
            label="Last name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            error={state?.fieldErrors?.lastName}
            disabled={isPending}
          />
        </div>

        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state?.fieldErrors?.email}
          disabled={isPending}
        />

        <Input
          label="Mobile number (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="087 123 4567"
          hint="Irish mobile — so your crèche can text you about your child."
          error={state?.fieldErrors?.phone}
          disabled={isPending}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          hint="Min. 8 characters, one uppercase letter, one number"
          error={state?.fieldErrors?.password}
          disabled={isPending}
        />

        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          error={state?.fieldErrors?.confirmPassword}
          disabled={isPending}
        />

        <Button type="submit" className="w-full" loading={isPending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-text-muted">
        Already have an account?{' '}
        <Link href={withTenant('/login')} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
