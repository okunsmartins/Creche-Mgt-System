import { Alert } from '@/components/ui/Alert'
import { signOutAndContinueAction } from '@/lib/auth/actions'

/** Query flag set when a staff login opens a parent page (see requireParent). */
export const PARENT_PAGE_NOTICE = 'parent_page'

/**
 * Shown on the staff dashboard after a staff login opened a parent-only page,
 * e.g. the "View & pay your invoices" link in a payment reminder. Staff can't use
 * the parent portal, so explain why they landed here instead of redirecting silently.
 */
export function StaffOnParentPageNotice() {
  return (
    <Alert variant="info" title="This link is for parents">
      <p>
        You&apos;re signed in as crèche staff. To view as a parent, sign out and sign in with your
        parent account.
      </p>
      <form action={signOutAndContinueAction} className="mt-3">
        <input type="hidden" name="next" value="/login" />
        <button type="submit" className="btn-outline text-sm">
          Sign out
        </button>
      </form>
    </Alert>
  )
}
