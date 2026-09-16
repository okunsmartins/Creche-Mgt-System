import type { Metadata } from 'next'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = { title: 'Set New Password' }

export default async function ResetPasswordPage() {
  const user = await getSessionUser()

  // No active session means the reset link was not followed (or has expired)
  if (!user) {
    return (
      <div className="card p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-text-primary">Link expired or invalid</h2>
        <p className="mb-6 text-sm text-text-muted">
          Your password reset link has expired or is invalid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="btn-primary inline-block text-sm">
          Request new link
        </Link>
      </div>
    )
  }

  return <ResetPasswordForm />
}
