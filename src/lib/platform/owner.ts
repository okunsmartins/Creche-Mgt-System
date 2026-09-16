import type { SessionUser } from '@/types'

/**
 * Platform-owner gating. The owner is identified by email (PLATFORM_OWNER_EMAIL,
 * comma-separated for more than one), NOT by a role — `super_admin` is a
 * PER-SCHOOL role, so it can't be used to gate an all-schools view.
 *
 * Pure helpers take the allowed emails explicitly so they're testable without env.
 */

export function parseOwnerEmails(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

export function isOwnerEmail(email: string | null | undefined, owners: readonly string[]): boolean {
  if (!email) return false
  return owners.includes(email.trim().toLowerCase())
}

/**
 * Configured owner emails. Read from process.env directly (not serverEnv) so
 * importing this in unit tests never triggers full env validation.
 */
export function getPlatformOwnerEmails(): string[] {
  return parseOwnerEmails(process.env['PLATFORM_OWNER_EMAIL'])
}

/** Whether the signed-in user is a platform owner. */
export function isPlatformOwner(user: Pick<SessionUser, 'email'> | null | undefined): boolean {
  return isOwnerEmail(user?.email ?? null, getPlatformOwnerEmails())
}
