'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { confirmEmailLinkAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/schemas'

/**
 * One-click step for email links. The link is only used when this button is
 * pressed, so email scanners that "open" links can't use it up first.
 */
export function ConfirmLinkForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string
  type: string
  next: string
}) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    confirmEmailLinkAction,
    null,
  )
  const isReset = type === 'recovery'

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-xl font-bold text-text-primary">
        {isReset ? 'Reset your password' : 'Confirm your email'}
      </h2>
      <p className="mb-6 text-sm text-text-muted">
        {isReset
          ? 'One more click and you can choose a new password.'
          : 'One more click to confirm your email address.'}
      </p>

      {state?.error ? (
        <>
          <Alert variant="error" className="mb-4">
            {state.error}
          </Alert>
          {isReset && (
            <Link href="/forgot-password" className="btn-primary inline-block text-sm">
              Request a new link
            </Link>
          )}
        </>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" className="w-full" loading={isPending}>
            {isReset ? 'Set my new password' : 'Confirm my email'}
          </Button>
        </form>
      )}
    </div>
  )
}
