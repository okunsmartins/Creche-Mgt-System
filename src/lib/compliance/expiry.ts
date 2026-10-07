/**
 * Generic expiry/renewal status logic for staff compliance items — pure, timezone-safe.
 *
 * Shared by Garda vetting ([[lib/vetting/vetting.ts]]) and staff certifications
 * (qualifications/training). A record's status is derived from its expiry date relative to
 * "today": valid, expiring soon, expired, or recorded-without-a-date. `missing` is a
 * subject-level state (no record at all) applied by the overview queries, not here.
 */

export type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'no-expiry' | 'missing'

/** Flag items this many days ahead of the expiry date by default. */
export const DEFAULT_WARN_DAYS = 60

/** Whole days from `fromISO` to `toISO` (both `YYYY-MM-DD`), parsed as UTC to avoid tz drift. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`)
  const b = Date.parse(`${toISO}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}

/**
 * Status of a single record from its expiry date. No date → `no-expiry` (recorded but no
 * expiry tracked). Never returns `missing` — that is applied at the subject level.
 */
export function expiryStatus(
  expiryISO: string | null | undefined,
  asOfISO: string,
  warnWithinDays: number = DEFAULT_WARN_DAYS,
): Exclude<ExpiryStatus, 'missing'> {
  if (!expiryISO) return 'no-expiry'
  const days = daysBetween(asOfISO, expiryISO)
  if (Number.isNaN(days)) return 'no-expiry'
  if (days < 0) return 'expired'
  if (days <= warnWithinDays) return 'expiring'
  return 'valid'
}

/** Whether a status warrants action (not recorded, expired, or expiring). */
export function needsAttention(status: ExpiryStatus): boolean {
  return status === 'missing' || status === 'expired' || status === 'expiring'
}

/** Badge colour bucket for a status. */
export function expiryStatusTone(
  status: ExpiryStatus,
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'valid':
      return 'success'
    case 'expiring':
      return 'warning'
    case 'expired':
      return 'error'
    case 'no-expiry':
    case 'missing':
      return 'default'
  }
}
