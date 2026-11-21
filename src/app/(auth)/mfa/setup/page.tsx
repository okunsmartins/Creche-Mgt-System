import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuthForMfa } from '@/lib/auth/guards'
import { adminMfaDecision } from '@/lib/auth/mfa-policy'
import { signOutAction } from '@/lib/auth/actions'
import { MfaSetupPanel } from '@/components/auth/MfaSetupPanel'

export const metadata: Metadata = { title: 'Set up two-step sign-in' }

// Uses requireAuthForMfa (not requireAuth/requireAdmin) so it can't redirect to itself.
export default async function MfaSetupPage() {
  const user = await requireAuthForMfa()
  if (!user.mfa) redirect('/')
  const decision = adminMfaDecision(user.mfa)
  if (user.mfa.nextLevel === 'aal2') redirect('/mfa/verify')

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">Set up two-step sign-in</h2>
        <p className="mt-1 text-sm text-text-muted">
          {decision.kind === 'grace'
            ? `Admin accounts need a code from your phone as well as your password. You have ${decision.daysLeft} day${decision.daysLeft === 1 ? '' : 's'} left to set it up.`
            : 'Admin accounts need a code from your phone as well as your password. Set it up to continue. It takes about a minute.'}
        </p>
      </div>
      <MfaSetupPanel />
      <form action={signOutAction} className="text-center">
        <button
          type="submit"
          className="text-xs text-text-muted hover:text-primary hover:underline"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
