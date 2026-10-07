/**
 * Garda (National Vetting Bureau) vetting status — vetting-specific labels over the shared
 * expiry logic in [[lib/compliance/expiry.ts]].
 *
 * Staff working with children must hold a current Garda vetting disclosure. There is no
 * statutory expiry, but crèches operate a renewal cycle (commonly 3 years), so each record
 * carries a renewal/expiry date. Status: valid, due for renewal soon, expired,
 * recorded-without-a-date, or not recorded at all.
 */

import {
  DEFAULT_WARN_DAYS,
  daysBetween,
  expiryStatus,
  needsAttention,
  expiryStatusTone,
  type ExpiryStatus,
} from '@/lib/compliance/expiry'

export type VettingStatus = ExpiryStatus

/** Flag renewals this many days ahead of the expiry date by default. */
export const VETTING_WARN_DAYS = DEFAULT_WARN_DAYS

export { daysBetween, needsAttention }

/** Status of a vetting record from its renewal/expiry date (see `expiryStatus`). */
export function vettingStatus(
  expiryISO: string | null | undefined,
  asOfISO: string,
  warnWithinDays: number = VETTING_WARN_DAYS,
): Exclude<VettingStatus, 'missing'> {
  return expiryStatus(expiryISO, asOfISO, warnWithinDays)
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
  return expiryStatusTone(status)
}
