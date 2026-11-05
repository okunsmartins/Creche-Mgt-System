import Link from 'next/link'
import { ArrowRight, LogOut } from 'lucide-react'
import { signOutAndContinueAction } from '@/lib/auth/actions'
import type { ExistingPortal } from '@/lib/onboarding/existing-portal'

const ROLE_WORDS: Record<ExistingPortal['role'], string> = {
  admin: 'an administrator',
  staff: 'a staff member',
  parent: 'a parent',
}

/**
 * Shown on the "create your portal" pages when the visitor is signed in to an
 * account that already belongs to a crèche. One account belongs to one crèche,
 * so a new crèche needs its own account: sign out and carry on, or go back.
 */
export function AlreadyInACreche({
  email,
  portal,
  continueTo,
  embedded = false,
}: {
  email: string
  portal: ExistingPortal
  /** Where to carry on after signing out (the step they were on). */
  continueTo: string
  /** Render inside another card (no card wrapper, smaller heading). */
  embedded?: boolean
}) {
  const creche = portal.schoolName ?? 'a crèche'
  const Heading = embedded ? 'h2' : 'h1'
  return (
    <div className={embedded ? 'mt-4 text-center' : 'card text-center'}>
      <Heading
        className={`font-display font-bold text-text-primary ${embedded ? 'text-lg' : 'text-2xl'}`}
      >
        You&apos;re signed in to {creche}
      </Heading>
      <p className="mt-3 text-sm text-text-secondary">
        You&apos;re signed in as <span className="font-semibold text-text-primary">{email}</span>,{' '}
        {ROLE_WORDS[portal.role]} at {creche}. Each crèche portal needs its own account, so to set
        up a <strong>new</strong> crèche, sign out and continue with a different email address.
      </p>

      <form action={signOutAndContinueAction} className="mt-6">
        <input type="hidden" name="next" value={continueTo} />
        <button
          type="submit"
          className="no-auth-gradient inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out and set up a new crèche
        </button>
      </form>

      <Link
        href={portal.href}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary/30 px-6 py-3 text-sm font-bold text-primary transition-all hover:bg-primary-light"
      >
        Go to my {portal.schoolName ?? 'current'} portal
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
