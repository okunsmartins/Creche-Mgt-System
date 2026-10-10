'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Lock, Mail } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { SocialLinks } from '@/components/social/SocialLinks'
import { signInAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'
import type { SocialLink } from '@/lib/social/links'

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
  /** The crèche being signed in to (null on the platform's own sign-in page). */
  schoolName?: string | null | undefined
  /** The crèche's social pages, set in Crèche Settings. */
  socialLinks?: SocialLink[] | undefined
}

export function LoginForm({
  next,
  reason,
  tenantSlug,
  schoolName,
  socialLinks = [],
}: LoginFormProps) {
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
    <div className="card">
      <h2 className="font-display text-3xl font-bold text-text-primary">Welcome back!</h2>
      <p className="mb-6 mt-1 text-center text-sm font-semibold text-text-secondary">
        Sign in to {schoolName ?? 'Creche Wise'} — parents, teachers and staff.
      </p>

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
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          required
          error={state?.fieldErrors?.email}
          disabled={isPending}
        />

        <div>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            leftIcon={<Lock className="h-4 w-4" />}
            required
            error={state?.fieldErrors?.password}
            disabled={isPending}
          />
          <div className="mt-2 text-right">
            <Link
              href={withTenant('/forgot-password')}
              className="text-sm font-bold text-[#6d3fd1] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="min-h-[50px] w-full bg-gradient-to-r from-[#c2255c] via-[#7048e8] to-primary text-base font-extrabold shadow-[0_10px_24px_-8px_rgba(112,72,232,0.6)] hover:opacity-95"
          loading={isPending}
        >
          Sign in
        </Button>
      </form>

      {socialLinks.length > 0 && (
        <div className="mt-7">
          <div className="flex items-center gap-3 text-xs font-bold text-text-secondary">
            <span className="h-px flex-1 bg-border" />
            Follow {schoolName ?? 'us'}
            <span className="h-px flex-1 bg-border" />
          </div>
          <SocialLinks links={socialLinks} schoolName={schoolName ?? 'Us'} className="mt-4" />
        </div>
      )}

      <p className="mt-7 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link
          href={withTenant('/register')}
          className="font-extrabold text-[#6d3fd1] hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  )
}
