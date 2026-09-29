import { z } from 'zod'
import type { EcceConfig } from './subvention'

// FEE-03. Effective-dated funding scheme configuration (ECCE capitation + NCS
// universal rate/caps) and per-tenant funding settings. National rates change
// each Budget, so they are versioned by date and resolved for a billing date
// rather than hardcoded — the subvention engine (FEE-05) consumes the resolved
// version. Mirrors the DB tables in migration 068.
//
// Dates are wall-clock 'YYYY-MM-DD' strings compared lexicographically (no
// timezone maths, matching the rest of the schema). effective_from is inclusive,
// effective_to is exclusive; null effective_to means the open-ended current
// version.

export type FundingScheme = 'ECCE' | 'NCS_UNIVERSAL'

/** ECCE capitation parameters (see migration 068 seed). */
export interface EcceParams {
  capitation_standard_weekly_cents: number
  capitation_higher_weekly_cents: number
  max_hours_per_day: number
  max_hours_per_week: number
  weeks_per_year: number
}

/** NCS universal-subsidy parameters. The income-assessed ceiling is for entry
 *  validation only — a child's actual rate comes from the CHICK award. */
export interface NcsUniversalParams {
  hourly_rate_cents: number
  max_hours_working: number
  max_hours_not_working: number
  min_age_weeks: number
  max_age_years: number
  income_assessed_max_hourly_rate_cents: number
}

export interface FundingSchemeVersion {
  scheme: FundingScheme
  /** Inclusive start date, 'YYYY-MM-DD'. */
  effectiveFrom: string
  /** Exclusive end date, 'YYYY-MM-DD', or null for the current version. */
  effectiveTo: string | null
  params: EcceParams | NcsUniversalParams
  sourceRef?: string
}

/** Format a Date as a wall-clock 'YYYY-MM-DD' string (local, no tz shift). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Resolve the scheme version applicable on `onDate` ('YYYY-MM-DD'): the version
 * whose [effectiveFrom, effectiveTo) window contains the date. If versions
 * overlap (should not happen), the latest start wins. Returns null when none
 * applies (e.g. a date before any configured version).
 */
export function resolveSchemeVersion(
  versions: readonly FundingSchemeVersion[],
  scheme: FundingScheme,
  onDate: string,
): FundingSchemeVersion | null {
  const matches = versions.filter(
    (v) =>
      v.scheme === scheme &&
      v.effectiveFrom <= onDate &&
      (v.effectiveTo === null || onDate < v.effectiveTo),
  )
  if (matches.length === 0) return null
  return matches.reduce((latest, v) => (v.effectiveFrom > latest.effectiveFrom ? v : latest))
}

/** Build the FEE-05 EcceConfig from a resolved ECCE version. */
export function ecceConfigFromVersion(version: FundingSchemeVersion): EcceConfig {
  if (version.scheme !== 'ECCE') {
    throw new Error(`ecceConfigFromVersion: expected ECCE version, got ${version.scheme}`)
  }
  const p = version.params as EcceParams
  return {
    capitationStandardWeeklyCents: p.capitation_standard_weekly_cents,
    capitationHigherWeeklyCents: p.capitation_higher_weekly_cents,
    maxHoursPerDay: p.max_hours_per_day,
    maxHoursPerWeek: p.max_hours_per_week,
  }
}

/** The NCS universal hourly rate from a resolved NCS version, cents. */
export function ncsUniversalRateCentsFromVersion(version: FundingSchemeVersion): number {
  if (version.scheme !== 'NCS_UNIVERSAL') {
    throw new Error(
      `ncsUniversalRateCentsFromVersion: expected NCS_UNIVERSAL, got ${version.scheme}`,
    )
  }
  return (version.params as NcsUniversalParams).hourly_rate_cents
}

/**
 * 2025/26 REFERENCE data mirroring the migration 068 seed. Use as a fallback
 * only — production reads the DB. CONFIRM every figure against the current Pobal
 * circular before go-live (docs/design/fee-subvention-engine.md §7).
 */
export const REFERENCE_FUNDING_VERSIONS: readonly FundingSchemeVersion[] = [
  {
    scheme: 'ECCE',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    params: {
      capitation_standard_weekly_cents: 6900,
      capitation_higher_weekly_cents: 8025,
      max_hours_per_day: 3,
      max_hours_per_week: 15,
      weeks_per_year: 38,
    },
    sourceRef: 'REFERENCE 2025/26 — CONFIRM with Pobal circular',
  },
  {
    scheme: 'NCS_UNIVERSAL',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    params: {
      hourly_rate_cents: 214,
      max_hours_working: 45,
      max_hours_not_working: 20,
      min_age_weeks: 24,
      max_age_years: 15,
      income_assessed_max_hourly_rate_cents: 510,
    },
    sourceRef: 'REFERENCE 2025/26 — CONFIRM with Pobal circular',
  },
]

// ─── Per-tenant funding settings (mirrors tenant_funding_settings) ────────────

export const BILLING_MODELS = ['BILL_ON_CONTRACTED', 'RECONCILE_ON_ATTENDANCE'] as const
export type BillingModel = (typeof BILLING_MODELS)[number]

/** CFG-01 onboarding toggles — the finite "both ways" choices (mig 069). */
export const FEE_MODELS = ['FLAT_PER_CHILD', 'PER_SESSION_TYPE'] as const
export type FeeModel = (typeof FEE_MODELS)[number]

export const GROSS_FEE_BASES = ['BEFORE_SUBSIDY', 'AFTER_SUBSIDY'] as const
export type GrossFeeBasis = (typeof GROSS_FEE_BASES)[number]

export const tenantFundingSettingsSchema = z.object({
  ecceEnabled: z.boolean(),
  ncsEnabled: z.boolean(),
  higherCapitationDefault: z.boolean(),
  subventionBillingModel: z.enum(BILLING_MODELS),
  // CFG-01 onboarding toggles
  feeModel: z.enum(FEE_MODELS),
  grossFeeBasis: z.enum(GROSS_FEE_BASES),
  depositsEnabled: z.boolean(),
})

export type TenantFundingSettings = z.infer<typeof tenantFundingSettingsSchema>

/** Safe defaults for a new tenant — the standard onboarding approach
 *  (ADR-002: bill on contracted, true-up later; flat fee; gross before subsidy). */
export const DEFAULT_TENANT_FUNDING_SETTINGS: TenantFundingSettings = {
  ecceEnabled: true,
  ncsEnabled: true,
  higherCapitationDefault: false,
  subventionBillingModel: 'BILL_ON_CONTRACTED',
  feeModel: 'FLAT_PER_CHILD',
  grossFeeBasis: 'BEFORE_SUBSIDY',
  depositsEnabled: false,
}
