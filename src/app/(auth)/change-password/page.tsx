import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth/guards'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'

export const metadata: Metadata = { title: 'Set your password' }

// Uses requireAuth (NOT requireTeacher/Admin/Verified) so a user flagged for a
// forced password change can reach this page without redirect-looping.
export default async function ChangePasswordPage() {
  await requireAuth()
  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">Set your password</h2>
        <p className="mt-1 text-sm text-text-muted">
          You signed in with a temporary password. Choose your own to continue.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  )
}
