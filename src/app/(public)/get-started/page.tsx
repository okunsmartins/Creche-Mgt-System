import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestPortalForm } from '@/components/onboarding/RequestPortalForm'
import { TeddyShell } from '@/components/auth/TeddyShell'

export const metadata: Metadata = { title: 'Create your portal' }

export default function GetStartedPage() {
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
