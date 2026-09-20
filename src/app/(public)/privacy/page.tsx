import type { Metadata } from 'next'
import { getViewerSchool } from '@/lib/tenant/server'

export const metadata: Metadata = {
  title: 'Privacy Notice',
}

export default async function PrivacyPage() {
  // Tenant-aware: on a school's portal the SCHOOL is the data controller; on the
  // apex (no tenant, nobody signed in) this is the platform-level notice.
  const school = await getViewerSchool()
  const controller = school?.name ?? null
  const contactEmail = school?.email ?? null

  return (
    <>
      {/* Hero — matches homepage colour scheme */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'radial-gradient(ellipse at top, #d6f4f2 0%, #fff8ee 62%)' }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {controller ?? 'Crèche Management System'}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Privacy <span className="text-primary">Notice</span>
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-sm max-w-none space-y-6 text-text-secondary">
          <div className="rounded-lg border border-warning/30 bg-warning-light p-4 text-sm text-warning">
            <strong>Development notice:</strong> This is a placeholder privacy notice for the proof
            of concept. A full GDPR-compliant privacy notice must be prepared by{' '}
            {controller ? `${controller}` : 'each school'} in consultation with their Data
            Protection Officer before the portal is used in production.
          </div>

          <section>
            <h2 className="text-lg font-semibold text-text-primary">Who we are</h2>
            {controller ? (
              <p>
                <strong>{controller}</strong> is the data controller for information collected
                through this payment portal. The portal is operated on the school&apos;s behalf by
                First Stack Solutions, which acts as a data processor.
                {contactEmail ? (
                  <>
                    {' '}
                    Contact the school at{' '}
                    <a href={`mailto:${contactEmail}`} className="text-primary underline">
                      {contactEmail}
                    </a>
                    .
                  </>
                ) : (
                  ' Contact your school office for data-protection queries.'
                )}
              </p>
            ) : (
              <p>
                This portal is operated by <strong>First Stack Solutions</strong>, which acts as a
                data processor for the schools that use it. Each school is the data controller for
                its own pupils&apos; and parents&apos; data — open your school&apos;s portal to see
                its specific privacy notice and contact details.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary">What information we collect</h2>
            <ul className="list-disc pl-5">
              <li>Parent / guardian name and email address</li>
              <li>Pupil first name, surname and class</li>
              <li>Payment references and amounts</li>
              <li>
                We do <strong>not</strong> store card numbers or payment-card details
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary">How we use your information</h2>
            <p>
              We use your information solely to process school payments, send receipts, and allow
              school administrators to reconcile payments. We do not share your information with
              third parties except as required to process payments (Stripe) and send emails
              (Resend).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary">Your rights</h2>
            <p>
              Under GDPR you have the right to access, rectify, or erase your personal data. To make
              a request, see our{' '}
              <a href="/contact" className="text-primary underline">
                contact page
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary">Retention</h2>
            <p>
              Payment records are retained for 7 years for financial reconciliation purposes in
              accordance with Irish Revenue requirements.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
