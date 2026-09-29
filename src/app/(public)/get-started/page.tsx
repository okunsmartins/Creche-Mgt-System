import type { Metadata } from 'next'
import { RequestPortalForm } from '@/components/onboarding/RequestPortalForm'

export const metadata: Metadata = { title: 'Create your portal' }

export default function GetStartedPage() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
    >
      <div className="mx-auto max-w-lg px-4 py-14 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Create your portal
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Set up your <span className="text-primary">school portal</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-text-secondary">
            First, confirm your email. We&apos;ll send you a link to verify it&apos;s really you —
            then you can finish creating your portal.
          </p>
        </div>

        <div className="mt-8">
          <RequestPortalForm />
        </div>
      </div>
    </section>
  )
}
