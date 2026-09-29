// ECCE + NCS subvention: nets Irish childcare subsidies off a parent's gross fee
// to produce the amount the parent actually pays, plus the amounts the provider
// receives from Pobal. Pure + server-authoritative — every figure is computed
// here from the tenant's rates, the child's award and attended/contracted hours;
// nothing is trusted from the client. Mirrors lib/payments/instalments.ts.
//
// Money is integer euro cents. Hours may be fractional. See
// docs/design/fee-subvention-engine.md for the full model.
//
// IMPORTANT: this module never re-implements the NCS means test. Pobal issues the
// awarded hourly rate + band hours on the CHICK; the caller passes them in as
// authoritative. The rate constants below are 2025/26 REFERENCE values and MUST
// be confirmed against the current Pobal circular before go-live (they are
// normally sourced from effective-dated config, not these fallbacks).

/** NCS Universal hourly subsidy, cents. REFERENCE 2025/26 — CONFIRM. */
export const NCS_UNIVERSAL_HOURLY_RATE_CENTS = 214

export interface EcceConfig {
  /** Standard weekly capitation paid to the provider, cents. */
  capitationStandardWeeklyCents: number
  /** Higher (graduate-led) weekly capitation, cents. */
  capitationHigherWeeklyCents: number
  /** Max ECCE hours zero-rated per day. */
  maxHoursPerDay: number
  /** Max ECCE hours zero-rated per week. */
  maxHoursPerWeek: number
}

/** ECCE reference parameters 2025/26 — CONFIRM against the current Pobal circular. */
export const DEFAULT_ECCE_CONFIG: EcceConfig = {
  capitationStandardWeeklyCents: 6900,
  capitationHigherWeeklyCents: 8025,
  maxHoursPerDay: 3,
  maxHoursPerWeek: 15,
}

/** A child's ECCE registration as it applies to a given week. */
export interface EcceAward {
  active: boolean
  /** True when the room qualifies for higher capitation. */
  higherCapitation: boolean
}

/** A child's NCS award (from the CHICK) as it applies to a given week. */
export interface NcsAward {
  active: boolean
  /** Awarded hourly rate from the CHICK, cents (authoritative — not computed here). */
  awardedHourlyRateCents: number
  /** Awarded band of subsidised hours per week. */
  awardedWeeklyHours: number
}

export interface WeekInput {
  /** The provider's commercial rate for this child, cents per hour. */
  providerHourlyRateCents: number
  /** Hours attended (or contracted) on each operating day of the week. */
  dayHours: number[]
  /** Whether this week falls inside the ECCE programme term (~38 weeks). */
  isEcceTermWeek: boolean
  ecce?: EcceAward | null
  ncs?: NcsAward | null
  /** Override the ECCE parameters; defaults to DEFAULT_ECCE_CONFIG. */
  ecceConfig?: EcceConfig
}

export interface WeekSubvention {
  /** Non-ECCE hours charged to the parent at the provider rate. */
  billableHours: number
  /** Hours zero-rated to the parent under ECCE. */
  ecceHours: number
  /** Gross parent charge for billable hours, cents. */
  grossParentCents: number
  /** Hours actually subsidised by NCS (≤ band, ≤ billable). */
  ncsSubsidisedHours: number
  /** NCS subsidy deducted from the parent charge, cents. */
  ncsSubsidyCents: number
  /** What the parent pays this week, cents (never negative). */
  netParentCents: number
  /** ECCE capitation the provider receives from Pobal, cents (flat weekly). */
  providerEcceCapitationCents: number
  /** NCS subsidy the provider claims from Pobal, cents (== ncsSubsidyCents). */
  providerNcsSubsidyCents: number
}

export interface PeriodSubvention {
  grossParentCents: number
  ncsSubsidyCents: number
  discountCents: number
  /** What the parent pays for the period, cents (never negative). */
  netParentCents: number
  ecceZeroRatedHours: number
  ncsSubsidisedHours: number
  /** Total ECCE capitation receivable from Pobal, cents. */
  providerReceivableEcceCents: number
  /** Total NCS subsidy receivable from Pobal, cents. */
  providerReceivableNcsCents: number
  /** Per-week breakdown (weeks sum exactly to the totals by construction). */
  weeks: WeekSubvention[]
}

/** Round a cents value to the nearest whole cent (half up for positives). */
function roundCents(value: number): number {
  return Math.round(value)
}

/**
 * Compute one week's subvention for a single child. Deterministic ordering:
 * ECCE zero-rates specific hours first, then NCS subsidises the remaining
 * eligible hours up to the band, then the parent pays the remainder. The net can
 * never go below zero and the NCS subsidy can never exceed the fee for the hours
 * it covers (no-profit cap — CONFIRM exact Pobal rule).
 */
export function computeWeekSubvention(input: WeekInput): WeekSubvention {
  const cfg = input.ecceConfig ?? DEFAULT_ECCE_CONFIG
  const rate = Math.max(0, input.providerHourlyRateCents)
  const dayHours = input.dayHours.map((h) => Math.max(0, h))
  const totalHours = dayHours.reduce((sum, h) => sum + h, 0)

  // 1. ECCE — zero-rate up to maxHoursPerDay/day, capped at maxHoursPerWeek,
  //    term-time only. Uniform rate means only the total zero-rated hours matter.
  const ecceActive = Boolean(input.ecce?.active) && input.isEcceTermWeek
  let ecceHours = 0
  let providerEcceCapitationCents = 0
  if (ecceActive) {
    const perDayEcce = dayHours.reduce((sum, h) => sum + Math.min(h, cfg.maxHoursPerDay), 0)
    ecceHours = Math.min(perDayEcce, cfg.maxHoursPerWeek)
    providerEcceCapitationCents = input.ecce?.higherCapitation
      ? cfg.capitationHigherWeeklyCents
      : cfg.capitationStandardWeeklyCents
  }

  // 2. Remaining hours are billed to the parent at the provider rate.
  const billableHours = totalHours - ecceHours
  const grossParentCents = roundCents(rate * billableHours)

  // 3. NCS subsidises billable hours up to the awarded band.
  let ncsSubsidisedHours = 0
  let ncsSubsidyCents = 0
  if (input.ncs?.active) {
    ncsSubsidisedHours = Math.min(billableHours, Math.max(0, input.ncs.awardedWeeklyHours))
    const rawSubsidy = roundCents(
      Math.max(0, input.ncs.awardedHourlyRateCents) * ncsSubsidisedHours,
    )
    const feeForSubsidisedHours = roundCents(rate * ncsSubsidisedHours)
    ncsSubsidyCents = Math.min(rawSubsidy, feeForSubsidisedHours, grossParentCents)
  }

  const netParentCents = grossParentCents - ncsSubsidyCents

  return {
    billableHours,
    ecceHours,
    grossParentCents,
    ncsSubsidisedHours,
    ncsSubsidyCents,
    netParentCents,
    providerEcceCapitationCents,
    providerNcsSubsidyCents: ncsSubsidyCents,
  }
}

/**
 * Compute a billing period from its operating weeks. Because each week's
 * amounts are already whole cents, the period totals are exact sums — there are
 * no orphan cents. An optional invoice-level discount is applied after subsidy
 * and can never push the net below zero.
 */
export function computePeriodSubvention(
  weekInputs: WeekInput[],
  opts?: { discountCents?: number },
): PeriodSubvention {
  const weeks = weekInputs.map(computeWeekSubvention)

  const grossParentCents = weeks.reduce((s, w) => s + w.grossParentCents, 0)
  const ncsSubsidyCents = weeks.reduce((s, w) => s + w.ncsSubsidyCents, 0)
  const providerReceivableEcceCents = weeks.reduce((s, w) => s + w.providerEcceCapitationCents, 0)
  const providerReceivableNcsCents = weeks.reduce((s, w) => s + w.providerNcsSubsidyCents, 0)
  const ecceZeroRatedHours = weeks.reduce((s, w) => s + w.ecceHours, 0)
  const ncsSubsidisedHours = weeks.reduce((s, w) => s + w.ncsSubsidisedHours, 0)

  const afterSubsidy = grossParentCents - ncsSubsidyCents
  const discountCents = Math.min(Math.max(0, opts?.discountCents ?? 0), afterSubsidy)
  const netParentCents = Math.max(0, afterSubsidy - discountCents)

  return {
    grossParentCents,
    ncsSubsidyCents,
    discountCents,
    netParentCents,
    ecceZeroRatedHours,
    ncsSubsidisedHours,
    providerReceivableEcceCents,
    providerReceivableNcsCents,
    weeks,
  }
}
