/**
 * Staff certifications (qualifications / training / other) — kinds + labels over the shared
 * expiry logic in [[lib/compliance/expiry.ts]]. Each certification is one record with an
 * optional expiry date; status is valid / expiring / expired / no-expiry. (`missing` from
 * ExpiryStatus is not used here — certifications are per-record, not per-teacher.)
 */

import { expiryStatus, expiryStatusTone, type ExpiryStatus } from '@/lib/compliance/expiry'

export const CERTIFICATION_KINDS = ['qualification', 'training', 'other'] as const
export type CertificationKind = (typeof CERTIFICATION_KINDS)[number]

export function isCertificationKind(v: string): v is CertificationKind {
  return (CERTIFICATION_KINDS as readonly string[]).includes(v)
}

export const CERTIFICATION_KIND_LABELS: Record<CertificationKind, string> = {
  qualification: 'Qualification',
  training: 'Training',
  other: 'Other',
}

export type CertificationStatus = Exclude<ExpiryStatus, 'missing'>

/** Status of a certification from its expiry date (see `expiryStatus`). */
export function certificationStatus(
  expiryISO: string | null | undefined,
  asOfISO: string,
  warnWithinDays?: number,
): CertificationStatus {
  return expiryStatus(expiryISO, asOfISO, warnWithinDays)
}

export function certificationStatusLabel(status: CertificationStatus): string {
  switch (status) {
    case 'valid':
      return 'Valid'
    case 'expiring':
      return 'Expiring'
    case 'expired':
      return 'Expired'
    case 'no-expiry':
      return 'No expiry date'
  }
}

export function certificationStatusTone(
  status: CertificationStatus,
): 'success' | 'warning' | 'error' | 'default' {
  return expiryStatusTone(status)
}

/** Whether a certification needs attention (expired or expiring). */
export function certificationNeedsAttention(status: CertificationStatus): boolean {
  return status === 'expired' || status === 'expiring'
}
