import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuthForMfa } from '@/lib/auth/guards'
import { signOutAction } from '@/lib/auth/actions'
import { MfaVerifyForm } from '@/components/auth/MfaVerifyForm'
import { safeNextPath } from '@/lib/auth/confirm-link'

export const metadata: Metadata = { title: 'Enter your code' }

// Uses requireAuthForMfa (not requireAuth/requireAdmin) so it can't redirect to itself.
export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await requireAuthForMfa()
  const raw = (await searchParams).next
  const next = raw ? safeNextPath(raw, '') || undefined : undefined
  if (!user.mfa) redirect('/')
  if (user.mfa.nextLevel !== 'aal2') redirect('/mfa/setup')
  if (user.mfa.currentLevel === 'aal2') redirect(next ?? '/admin/dashboard')

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">Enter your code</h2>
        <p className="mt-1 text-sm text-text-muted">
          Open your authenticator app and enter the 6-digit code for Creche Wise.
        </p>
      </div>
      <MfaVerifyForm next={next} />
      <p className="text-center text-xs text-text-muted">
        Lost your phone? Contact Creche Wise support to reset two-step sign-in.
      </p>
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
