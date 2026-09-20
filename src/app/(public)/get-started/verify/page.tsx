import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowRight, LogOut } from 'lucide-react'
import { verifyPortalSignupByToken, type VerifyResult } from '@/lib/onboarding/signups'
import { getSessionUser } from '@/lib/auth/session'
import { signOutAction } from '@/lib/auth/actions'

export const metadata: Metadata = { title: 'Confirm your email' }

export default async function VerifyPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const [outcome, user] = await Promise.all([
    token
      ? verifyPortalSignupByToken(token)
      : Promise.resolve({ result: 'not_found' as VerifyResult, email: null }),
    getSessionUser(),
  ])
  const ok = outcome.result === 'verified' || outcome.result === 'already'

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
    >
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface p-8">
          {!ok ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
                <XCircle className="h-7 w-7 text-error" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">Link not valid</h1>
              <p className="mt-2 text-sm text-text-secondary">
                This confirmation link is invalid or has expired. Please request a new one.
              </p>
              <Link
                href="/get-started"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 px-6 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/10"
              >
                Start again
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-7 w-7 text-success" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">Email confirmed</h1>

              {user ? (
                <>
                  <p className="mt-2 text-sm text-text-secondary">
                    You&apos;re currently signed in as{' '}
                    <span className="font-semibold text-text-primary">{user.email}</span>. Creating
                    a new school portal needs its own account — please sign out, then open this
                    confirmation link again to register.
                  </p>
                  <form action={signOutAction} className="mt-6">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-text-secondary">
                    Thanks — your email is verified. Next, create your account to set up your school
                    portal.
                  </p>
                  <Link
                    href="/onboarding"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                  >
                    Create your portal
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
