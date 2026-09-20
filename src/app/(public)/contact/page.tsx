import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone, MapPin } from 'lucide-react'
import { getViewerSchool, type School } from '@/lib/tenant/server'

export const metadata: Metadata = {
  title: 'Contact',
}

// Crèche Management System platform contact addresses (shown on the public site, not inside a
// school's portal). All three forward to the team inbox.
const PLATFORM_CONTACTS: { title: string; email: string; description: string }[] = [
  {
    title: 'General enquiries',
    email: 'info@skoolbido.com',
    description: 'Questions about Crèche Management System, how it works, or getting started.',
  },
  {
    title: 'Schools & sales',
    email: 'contact@skoolbido.com',
    description: 'Thinking of using Crèche Management System for your school? Talk to us about setting it up.',
  },
  {
    title: 'Support',
    email: 'support@skoolbido.com',
    description: 'Already using Crèche Management System? Get help with your portal or report an issue.',
  },
]

function formatAddress(s: School): string | null {
  const parts = [s.address_line1, s.address_line2, s.city, s.county, s.eircode].filter(
    (p): p is string => !!p && p.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(', ') : null
}

export default async function ContactPage() {
  const school = await getViewerSchool()
  const address = school ? formatAddress(school) : null
  const hasDetails = !!(school && (school.email || school.phone || address))

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
            {school?.name ?? 'Crèche Management System'}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Contact <span className="text-primary">us</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            {school
              ? 'If you have a question about a payment or need assistance, please contact the school office.'
              : 'Get in touch with the Crèche Management System team — pick the inbox that fits and we’ll be happy to help.'}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {!school ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {PLATFORM_CONTACTS.map((c) => (
                <div key={c.email} className="card flex flex-col p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="text-sm font-semibold text-text-primary">{c.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-text-muted">{c.description}</p>
                  <a
                    href={`mailto:${c.email}`}
                    className="mt-3 break-all text-sm font-medium text-primary hover:underline"
                  >
                    {c.email}
                  </a>
                </div>
              ))}
            </div>
            <div className="card p-6 text-sm text-text-secondary">
              <p className="font-medium text-text-primary">Are you a parent?</p>
              <p className="mt-1">
                To reach your child&apos;s school, open your school&apos;s portal or{' '}
                <Link href="/activities" className="text-primary hover:underline">
                  find your school
                </Link>
                .
              </p>
            </div>
          </div>
        ) : hasDetails ? (
          <div className="card divide-y divide-border">
            {school.email && (
              <div className="flex items-center gap-4 p-5">
                <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-text-muted">Email</p>
                  <a
                    href={`mailto:${school.email}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {school.email}
                  </a>
                </div>
              </div>
            )}
            {school.phone && (
              <div className="flex items-center gap-4 p-5">
                <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-text-muted">Phone</p>
                  <p className="text-sm font-medium text-text-primary">{school.phone}</p>
                </div>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-4 p-5">
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-text-muted">Address</p>
                  <p className="text-sm text-text-primary">{address}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-6 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Contact the school office</p>
            <p className="mt-1">
              {school.name} hasn&apos;t added contact details to the portal yet. Please reach the
              school office directly.
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">Data access requests</p>
          <p className="mt-1">
            To request access to, correction of, or deletion of your personal data held by{' '}
            {school?.name ?? 'your school'}, please contact the school office
            {school?.email ? (
              <>
                {' '}
                at{' '}
                <a href={`mailto:${school.email}`} className="text-primary underline">
                  {school.email}
                </a>
              </>
            ) : null}{' '}
            with the subject line <span className="font-mono text-xs">Data Access Request</span>.
          </p>
        </div>
      </div>
    </>
  )
}
