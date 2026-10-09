'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { acceptInviteAuthedAction, type AcceptInviteState } from '@/lib/parent-invites/accept'

/** Shown when a parent is already signed in — links the invited child to their account. */
export function InviteAuthedButton({ token, childName }: { token: string; childName: string }) {
  const [state, action, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAuthedAction,
    null,
  )
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state && 'error' in state && <Alert variant="error">{state.error}</Alert>}
      <Button type="submit" loading={pending} className="w-full">
        Link {childName} to my account
      </Button>
    </form>
  )
}
