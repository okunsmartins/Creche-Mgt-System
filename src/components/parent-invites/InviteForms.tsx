'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'
import {
  acceptInviteSignupAction,
  acceptInviteSigninAction,
  type AcceptInviteState,
} from '@/lib/parent-invites/accept'

/**
 * Sign-up / sign-in tabs for an invited parent. The token is carried as a hidden
 * field; on success the server action links the child and redirects to the portal.
 */
export function InviteForms({ token, email }: { token: string; email?: string | undefined }) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [signupState, signupAction, signupPending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteSignupAction,
    null,
  )
  const [signinState, signinAction, signinPending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteSigninAction,
    null,
  )

  return (
    <div className="space-y-5">
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            mode === 'signup'
              ? 'bg-primary text-white'
              : 'bg-surface text-text-secondary hover:bg-gray-50',
          )}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={cn(
            'flex-1 border-l border-border px-4 py-2.5 text-sm font-medium transition-colors',
            mode === 'signin'
              ? 'bg-primary text-white'
              : 'bg-surface text-text-secondary hover:bg-gray-50',
          )}
        >
          I already have an account
        </button>
      </div>

      {mode === 'signup' ? (
        <form action={signupAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {signupState && 'error' in signupState && (
            <Alert variant="error">{signupState.error}</Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" name="firstName" required disabled={signupPending} />
            <Input label="Last name" name="lastName" required disabled={signupPending} />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            required
            defaultValue={email ?? ''}
            disabled={signupPending}
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            hint="At least 8 characters."
            disabled={signupPending}
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            required
            disabled={signupPending}
            autoComplete="new-password"
          />
          <Button type="submit" loading={signupPending} className="w-full">
            Create account &amp; link my child
          </Button>
        </form>
      ) : (
        <form action={signinAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {signinState && 'error' in signinState && (
            <Alert variant="error">{signinState.error}</Alert>
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            required
            defaultValue={email ?? ''}
            disabled={signinPending}
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            disabled={signinPending}
            autoComplete="current-password"
          />
          <Button type="submit" loading={signinPending} className="w-full">
            Sign in &amp; link my child
          </Button>
        </form>
      )}
    </div>
  )
}
