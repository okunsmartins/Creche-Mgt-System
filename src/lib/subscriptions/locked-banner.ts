/**
 * The banner at the top of /pricing when a crèche's portal is locked.
 *
 * Every portal layout sends a locked crèche's users here (see
 * requireSchoolAccessOrRedirect). This decides what they see at the top, so
 * they know which crèche it is and what to do:
 *  - an admin of that crèche → its name + a Subscribe button
 *  - its staff or parents → its name + "ask your crèche manager"
 *  - signed out, or a crèche that isn't locked → the generic message (or nothing)
 * Pure: unit-tested.
 */

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

export type LockReason = 'trial_ended' | 'start_trial'

export type LockedBanner =
  | { kind: 'none' }
  /** Signed out (or no crèche): the plain, nameless message. */
  | { kind: 'generic'; reason: LockReason }
  /** An admin of the locked crèche: name + Subscribe button. */
  | { kind: 'admin'; reason: LockReason; schoolName: string }
  /** Staff or a parent of the locked crèche: name + "ask the manager". */
  | { kind: 'member'; reason: LockReason; schoolName: string }

type UserLike = { roles: string[]; schoolId: string | null; schoolName: string | null }

/** Maps the /pricing query (`?reason=` or the older `?locked=`) to a lock reason. */
export function lockReasonFrom(params: {
  reason?: string | undefined
  locked?: string | undefined
}): LockReason | null {
  if (params.reason === 'trial_ended' || params.reason === 'start_trial') return params.reason
  if (params.locked) return 'trial_ended'
  return null
}

export function lockedBannerFor({
  reason,
  user,
  schoolHasAccess,
}: {
  reason: LockReason | null
  user: UserLike | null
  /** Whether the signed-in user's crèche can currently use the portal. */
  schoolHasAccess: boolean
}): LockedBanner {
  if (!reason) return { kind: 'none' }
  if (!user?.schoolId) return { kind: 'generic', reason }
  // Someone landing on an old ?reason= link once their crèche is subscribed
  // shouldn't be told it's locked.
  if (schoolHasAccess) return { kind: 'none' }
  const schoolName = user.schoolName?.trim() || 'Your crèche'
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r))
  return isAdmin ? { kind: 'admin', reason, schoolName } : { kind: 'member', reason, schoolName }
}
