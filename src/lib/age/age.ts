// Age helpers for NCS eligibility and age-band grouping. Pure + unit-tested.
// All dates are wall-clock 'YYYY-MM-DD' compared in UTC (no timezone drift).

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtc(iso: string): Date {
  const m = iso.match(ISO)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
}

const MS_PER_DAY = 86_400_000

/** Whole days from dob to `at` (>= 0 clamps negatives to 0). */
export function ageInDaysAt(dobISO: string, atISO: string): number {
  const days = Math.floor((toUtc(atISO).getTime() - toUtc(dobISO).getTime()) / MS_PER_DAY)
  return Math.max(0, days)
}

/** Completed weeks of age at `at`. */
export function ageInWeeksAt(dobISO: string, atISO: string): number {
  return Math.floor(ageInDaysAt(dobISO, atISO) / 7)
}

/** Completed calendar months of age at `at`. */
export function ageInMonthsAt(dobISO: string, atISO: string): number {
  const dob = toUtc(dobISO)
  const at = toUtc(atISO)
  if (at <= dob) return 0
  let months =
    (at.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (at.getUTCMonth() - dob.getUTCMonth())
  if (at.getUTCDate() < dob.getUTCDate()) months -= 1
  return Math.max(0, months)
}

/** Completed years of age at `at`. */
export function ageInYearsAt(dobISO: string, atISO: string): number {
  return Math.floor(ageInMonthsAt(dobISO, atISO) / 12)
}

export interface NcsAgeConfig {
  /** Minimum age in weeks to qualify for NCS (reference: 24). */
  minAgeWeeks: number
  /** Maximum age in years (exclusive) — child ages out at this birthday (reference: 15). */
  maxAgeYears: number
}

export interface NcsAgeResult {
  eligible: boolean
  ageWeeks: number
  ageYears: number
  reason?: string
}

/**
 * Whether a child is within the NCS age window on a given date. This is the AGE
 * gate only — it does not assess income/means (that comes from the CHICK award).
 */
export function ncsAgeEligibility(dobISO: string, atISO: string, cfg: NcsAgeConfig): NcsAgeResult {
  const ageWeeks = ageInWeeksAt(dobISO, atISO)
  const ageYears = ageInYearsAt(dobISO, atISO)
  if (ageWeeks < cfg.minAgeWeeks) {
    return { eligible: false, ageWeeks, ageYears, reason: `Under ${cfg.minAgeWeeks} weeks old` }
  }
  if (ageYears >= cfg.maxAgeYears) {
    return { eligible: false, ageWeeks, ageYears, reason: `Aged out (>= ${cfg.maxAgeYears} years)` }
  }
  return { eligible: true, ageWeeks, ageYears }
}

/** Human label like "2y 3m" or "18m" for display next to a child. */
export function ageLabel(dobISO: string, atISO: string): string {
  const months = ageInMonthsAt(dobISO, atISO)
  if (months < 24) return `${months}m`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m === 0 ? `${y}y` : `${y}y ${m}m`
}
