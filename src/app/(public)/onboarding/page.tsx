import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { hasVerifiedSignup } from '@/lib/onboarding/signups'
import { CreateSchoolForm } from '@/components/tenant/CreateSchoolForm'
import { TeddyShell } from '@/components/auth/TeddyShell'
import { AlreadyInACreche } from '@/components/onboarding/AlreadyInACreche'
import { existingPortalFor } from '@/lib/onboarding/existing-portal'

export const metadata: Metadata = { title: 'Create your crèche' }

export default async function OnboardingPage() {
  // A logged-out visitor arriving from the "Create your own portal" CTA almost
  // certainly has no account yet, so send them to register (not sign-in) and
  // carry `next` so they land back here afterwards.
  const user = await requireAuth('/onboarding', 'register')

  // Onboarding is only for accounts that don't already belong to a crèche (so
  // creating one can't reassign an existing account). Say so clearly, with a way
  // to sign out and carry on, rather than silently sending them to that portal.
  const portal = existingPortalFor(user)
  if (portal) {
    return (
      <TeddyShell>
        <AlreadyInACreche email={user.email} portal={portal} continueTo="/onboarding" />
      </TeddyShell>
    )
  }

  // Gate: the account's email must have a CONFIRMED portal sign-up — so we know
  // the address is theirs before they set up a crèche. If not, send them to the
  // email-verification step first.
  if (!(await hasVerifiedSignup(user.email))) redirect('/get-started')

  return (
    <TeddyShell footer="You'll become the administrator of this crèche and can invite staff and add children right away.">
      <div className="card">
        <h1 className="text-center font-display text-3xl font-bold text-text-primary">
          Create your crèche portal
        </h1>
        <p className="mb-6 mt-1 text-center text-sm font-semibold text-text-secondary">
          Pick a name and a web address. We&apos;ll set up your rooms, settings and admin account in
          seconds.
        </p>
        <CreateSchoolForm />
      </div>
    </TeddyShell>
  )
}
