import Link from 'next/link'
import { School, ArrowRight } from 'lucide-react'

/**
 * Shown on school-specific public pages (activities, programmes, guest payment)
 * when no tenant can be identified — no subdomain, no `/s/<sub>` cookie, nobody
 * signed in.
 *
 * Deliberately does NOT list schools. Enumerating every active school here would
 * publish the full customer list to anyone who visits the apex. Instead we point
 * visitors at the link their school shared with them: parents reach their school
 * through its own subdomain or the pay/portal link the school sends — there is no
 * public school directory.
 */
export function FindYourSchool() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <School className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-text-primary">Looking for your school?</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          Open your school&apos;s portal using the link they shared with you — usually your
          school&apos;s own web address, or the payment link in a message from the school. If
          you&apos;re not sure, ask your school office for their Crèche Management System link.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface px-5 py-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>{' '}
        to reach your school&apos;s portal.
      </div>

      <p className="mt-8 text-center text-xs text-text-muted">
        Run a school?{' '}
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          Create your own portal
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}
