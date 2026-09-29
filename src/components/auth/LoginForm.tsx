'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { signInAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

const REASON_MESSAGES: Record<string, string> = {
  auth_required: 'Please sign in to continue.',
  auth_error: 'An authentication error occurred. Please try again.',
  session_expired: 'Your session has expired. Please sign in again.',
  password_changed: 'Your password has been updated. Please sign in with your new password.',
  teacher_required: 'Please sign in with your teacher account to continue.',
}

interface LoginFormProps {
  next?: string | undefined
  reason?: string | undefined
  /** School slug when signing in within a crèche's context (`/s/<slug>/login`). */
  tenantSlug?: string | undefined
}

export function LoginForm({ next, reason, tenantSlug }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    signInAction,
    null,
  )

  const reasonMessage = reason ? (REASON_MESSAGES[reason] ?? null) : null

  // Keep the crèche in the URL so a parent who came via /s/<school> stays in that
  // school's context — otherwise "Register" drops them onto the bare apex, which
  // is the owner "create a portal" flow, not parent sign-up.
  const withTenant = (href: string) => (tenantSlug ? `/s/${tenantSlug}${href}` : href)

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-xl font-bold text-text-primary">Sign in</h2>
      <p className="mb-6 text-sm text-text-muted">Parents, teachers and staff all sign in here.</p>

      {reasonMessage && (
        <Alert variant="info" className="mb-4">
          {reasonMessage}
        </Alert>
      )}

      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state?.fieldErrors?.email}
          disabled={isPending}
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          error={state?.fieldErrors?.password}
          disabled={isPending}
        />

        <Button type="submit" className="w-full" loading={isPending}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-center text-xs text-text-muted">
        <Link href={withTenant('/forgot-password')} className="hover:text-primary hover:underline">
          Forgot your password?
        </Link>
        <span>
          No account?{' '}
          <Link href={withTenant('/register')} className="font-medium text-primary hover:underline">
            Register
          </Link>
        </span>
      </div>
    </div>
  )
}
