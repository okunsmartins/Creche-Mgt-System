/**
 * "Create your portal" while already signed in.
 *
 * An account belongs to one crèche (profiles.school_id), so a person who is
 * already an admin, teacher or parent somewhere can't turn that same account into
 * the owner of a NEW crèche. Instead of silently sending them back to their
 * existing portal, the onboarding pages explain this and offer to sign out and
 * carry on with a new account. Pure — unit-tested.
 */

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

export type ExistingPortal = {
  /** Where their current portal lives. */
  href: string
  /** The crèche they're signed in to (null if the name couldn't be resolved). */
  schoolName: string | null
  /** How they're attached, for the explanation copy. */
  role: 'admin' | 'staff' | 'parent'
}

type UserLike = { roles: string[]; schoolId: string | null; schoolName: string | null }

/** The portal this signed-in user already belongs to, or null if they're free to create one. */
export function existingPortalFor(user: UserLike | null): ExistingPortal | null {
  if (!user) return null
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) {
    return { href: '/admin/dashboard', schoolName: user.schoolName, role: 'admin' }
  }
  if (user.roles.includes('teacher')) {
    return { href: '/teacher/dashboard', schoolName: user.schoolName, role: 'staff' }
  }
  if (user.schoolId) {
    return { href: '/parent/dashboard', schoolName: user.schoolName, role: 'parent' }
  }
  return null
}
