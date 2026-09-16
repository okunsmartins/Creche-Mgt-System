import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import { ResendVerificationForm } from '@/components/auth/ResendVerificationForm'

export const metadata: Metadata = { title: 'Verify Your Email' }

export default function VerifyEmailPage() {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
        <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-text-primary">Check your email</h2>
      <p className="text-sm text-text-muted">
        We sent a verification link to your email address. Click the link to activate your account.
      </p>
      <p className="mt-3 text-xs text-text-muted">
        The link expires after 24 hours. Check your spam folder if you don&apos;t see it.
      </p>

      <ResendVerificationForm />
    </div>
  )
}
