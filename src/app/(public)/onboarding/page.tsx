import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { hasVerifiedSignup } from '@/lib/onboarding/signups'
import { CreateSchoolForm } from '@/components/tenant/CreateSchoolForm'

export const metadata: Metadata = { title: 'Create your school' }

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

export default async function OnboardingPage() {
  // A logged-out visitor arriving from the "Create your own portal" CTA almost
  // certainly has no account yet, so send them to register (not sign-in) and
  // carry `next` so they land back here afterwards.
  const user = await requireAuth('/onboarding', 'register')

  // Onboarding is only for users who don't already belong to a school. Staff go
  // to their portal; anyone already attached to a school (e.g. a parent) goes to
  // the parent portal — so creating a school can't reassign their account.
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) redirect('/admin/dashboard')
  if (user.roles.includes('teacher')) redirect('/teacher/dashboard')
  if (user.schoolId) redirect('/parent/dashboard')

  // Gate: the account's email must have a CONFIRMED portal sign-up — so we know
  // the address is theirs before they set up a school. If not, send them to the
  // email-verification step first.
  if (!(await hasVerifiedSignup(user.email))) redirect('/get-started')

  return (
    <>
      {/* Hero — matches homepage colour scheme */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Set up your school
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Create your <span className="text-primary">school portal</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            Pick a name and a web address. We&apos;ll set up your environment — classes, settings
            and your admin account — in seconds.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="card p-6">
          <CreateSchoolForm />
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          You&apos;ll become the administrator of this school and can invite teachers and add pupils
          right away.
        </p>
      </section>
    </>
  )
}
