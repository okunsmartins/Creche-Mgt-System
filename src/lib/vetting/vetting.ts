/**
 * Garda (National Vetting Bureau) vetting status logic — pure, timezone-safe.
 *
 * Staff working with children must hold a current Garda vetting disclosure. There is no
 * statutory expiry, but crèches operate a renewal cycle (commonly 3 years), so each record
 * carries a renewal/expiry date. Status is derived from that date relative to "today":
 * valid, due for renewal soon, expired, recorded-without-a-date, or not recorded at all.
 */

export type VettingStatus = 'valid' | 'expiring' | 'expired' | 'no-expiry' | 'missing'

/** Flag renewals this many days ahead of the expiry date by default. */
export const VETTING_WARN_DAYS = 60

/** Whole days from `fromISO` to `toISO` (both `YYYY-MM-DD`), parsed as UTC to avoid tz drift. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`)
  const b = Date.parse(`${toISO}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}

/**
 * Status of a single vetting record from its expiry date. A record with no expiry date is
 * `no-expiry` (recorded, but no renewal tracked). Never returns `missing` — that is a
 * teacher-level state (no record at all), applied by the overview query.
 */
export function vettingStatus(
  expiryISO: string | null | undefined,
  asOfISO: string,
  warnWithinDays: number = VETTING_WARN_DAYS,
): Exclude<VettingStatus, 'missing'> {
  if (!expiryISO) return 'no-expiry'
  const days = daysBetween(asOfISO, expiryISO)
  if (Number.isNaN(days)) return 'no-expiry'
  if (days < 0) return 'expired'
  if (days <= warnWithinDays) return 'expiring'
  return 'valid'
}

/** Whether a status warrants staff action (not recorded, expired, or due for renewal). */
export function needsAttention(status: VettingStatus): boolean {
  return status === 'missing' || status === 'expired' || status === 'expiring'
}

export function vettingStatusLabel(status: VettingStatus): string {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'expiring':
      return 'Renewal due'
    case 'expired':
      return 'Expired'
    case 'no-expiry':
      return 'No renewal date'
    case 'missing':
      return 'Not recorded'
  }
}

/** Badge colour bucket for a status. */
export function vettingStatusTone(
  status: VettingStatus,
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
