import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestPortalForm } from '@/components/onboarding/RequestPortalForm'
import { TeddyShell } from '@/components/auth/TeddyShell'
import { AlreadyInACreche } from '@/components/onboarding/AlreadyInACreche'
import { getSessionUser } from '@/lib/auth/session'
import { existingPortalFor } from '@/lib/onboarding/existing-portal'

export const metadata: Metadata = { title: 'Create your portal' }

export default async function GetStartedPage() {
  // Signed in to an account that already belongs to a crèche → explain that a new
  // crèche needs its own account, instead of letting them start a sign-up that
  // would later bounce them back to their existing portal.
  const user = await getSessionUser()
  const portal = existingPortalFor(user)
  if (user && portal) {
    return (
      <TeddyShell>
        <AlreadyInACreche email={user.email} portal={portal} continueTo="/get-started" />
      </TeddyShell>
    )
  }

  return (
    <TeddyShell
      footer={
        <>
          Already have a portal?{' '}
          <Link href="/login" className="font-extrabold text-[#6d3fd1] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="card">
        <h1 className="text-center font-display text-3xl font-bold text-text-primary">
          Set up your crèche portal
        </h1>
        <p className="mb-6 mt-1 text-center text-sm font-semibold text-text-secondary">
          First, confirm your email. We&apos;ll send you a link to check it&apos;s really you — then
          you can finish creating your portal. Your first month is free.
        </p>
        <RequestPortalForm />
      </div>
    </TeddyShell>
  )
}
