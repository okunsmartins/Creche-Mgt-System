import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { hasVerifiedSignup } from '@/lib/onboarding/signups'
import { CreateSchoolForm } from '@/components/tenant/CreateSchoolForm'
import { TeddyShell } from '@/components/auth/TeddyShell'

export const metadata: Metadata = { title: 'Create your crèche' }

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

export default async function OnboardingPage() {
  // A logged-out visitor arriving from the "Create your own portal" CTA almost
  // certainly has no account yet, so send them to register (not sign-in) and
  // carry `next` so they land back here afterwards.
  const user = await requireAuth('/onboarding', 'register')

  // Onboarding is only for users who don't already belong to a crèche. Staff go
  // to their portal; anyone already attached to a crèche (e.g. a parent) goes to
  // the parent portal — so creating a crèche can't reassign their account.
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) redirect('/admin/dashboard')
  if (user.roles.includes('teacher')) redirect('/teacher/dashboard')
  if (user.schoolId) redirect('/parent/dashboard')

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
