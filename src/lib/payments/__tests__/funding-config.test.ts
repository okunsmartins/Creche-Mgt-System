import { describe, it, expect } from 'vitest'
import {
  resolveSchemeVersion,
  toIsoDate,
  ecceConfigFromVersion,
  ncsUniversalRateCentsFromVersion,
  tenantFundingSettingsSchema,
  DEFAULT_TENANT_FUNDING_SETTINGS,
  REFERENCE_FUNDING_VERSIONS,
  type FundingSchemeVersion,
} from '../funding-config'
import { computeWeekSubvention } from '../subvention'

const ecceOld: FundingSchemeVersion = {
  scheme: 'ECCE',
  effectiveFrom: '2024-09-01',
  effectiveTo: '2025-09-01',
  params: {
    capitation_standard_weekly_cents: 6500,
    capitation_higher_weekly_cents: 7800,
    max_hours_per_day: 3,
    max_hours_per_week: 15,
    weeks_per_year: 38,
  },
}
const ecceCurrent: FundingSchemeVersion = {
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
}
const versions = [ecceOld, ecceCurrent]

describe('resolveSchemeVersion', () => {
  it('resolves the version whose window contains the date', () => {
    expect(resolveSchemeVersion(versions, 'ECCE', '2025-06-01')).toBe(ecceOld)
    expect(resolveSchemeVersion(versions, 'ECCE', '2026-01-01')).toBe(ecceCurrent)
  })

  it('treats effective_from as inclusive and effective_to as exclusive', () => {
    // On the boundary date the OLD window (…, 2025-09-01) has ended and the new one begins.
    expect(resolveSchemeVersion(versions, 'ECCE', '2025-08-31')).toBe(ecceOld)
    expect(resolveSchemeVersion(versions, 'ECCE', '2025-09-01')).toBe(ecceCurrent)
  })

  it('returns null before any version or for an unconfigured scheme', () => {
    expect(resolveSchemeVersion(versions, 'ECCE', '2024-08-31')).toBeNull()
    expect(resolveSchemeVersion(versions, 'NCS_UNIVERSAL', '2026-01-01')).toBeNull()
  })

  it('picks the latest start when windows overlap (defensive)', () => {
    const a: FundingSchemeVersion = { ...ecceOld, effectiveFrom: '2025-01-01', effectiveTo: null }
    const b: FundingSchemeVersion = { ...ecceCurrent, effectiveFrom: '2025-06-01', effectiveTo: null }
    expect(resolveSchemeVersion([a, b], 'ECCE', '2025-12-01')).toBe(b)
  })
})

describe('toIsoDate', () => {
  it('formats a Date as wall-clock YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 8, 16))).toBe('2026-09-16') // month is 0-indexed
    expect(toIsoDate(new Date(2025, 0, 5))).toBe('2025-01-05')
  })
})

describe('mappers', () => {
  it('builds an EcceConfig from an ECCE version', () => {
    expect(ecceConfigFromVersion(ecceCurrent)).toEqual({
      capitationStandardWeeklyCents: 6900,
      capitationHigherWeeklyCents: 8025,
      maxHoursPerDay: 3,
      maxHoursPerWeek: 15,
    })
  })

  it('reads the NCS universal rate from an NCS version', () => {
    const ncs = resolveSchemeVersion(REFERENCE_FUNDING_VERSIONS, 'NCS_UNIVERSAL', '2026-01-01')!
    expect(ncsUniversalRateCentsFromVersion(ncs)).toBe(214)
  })

  it('throws when a mapper is given the wrong scheme', () => {
    expect(() => ecceConfigFromVersion(REFERENCE_FUNDING_VERSIONS[1]!)).toThrow()
    expect(() => ncsUniversalRateCentsFromVersion(ecceCurrent)).toThrow()
  })
})

describe('reference config feeds the FEE-05 engine (integration)', () => {
  it('reproduces the worked example from resolved 2025/26 config', () => {
    const onDate = '2026-01-01'
    const ecceCfg = ecceConfigFromVersion(
      resolveSchemeVersion(REFERENCE_FUNDING_VERSIONS, 'ECCE', onDate)!,
    )
    const ncsRate = ncsUniversalRateCentsFromVersion(
      resolveSchemeVersion(REFERENCE_FUNDING_VERSIONS, 'NCS_UNIVERSAL', onDate)!,
    )
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: [8, 8, 8, 8, 8],
      isEcceTermWeek: true,
      ecce: { active: true, higherCapitation: false },
      ncs: { active: true, awardedHourlyRateCents: ncsRate, awardedWeeklyHours: 45 },
      ecceConfig: ecceCfg,
    })
    expect(r.netParentCents).toBe(9650) // €96.50
    expect(r.providerEcceCapitationCents).toBe(6900) // €69.00
    expect(r.ncsSubsidyCents).toBe(5350) // €53.50
  })
})

describe('tenantFundingSettingsSchema', () => {
  it('accepts the defaults', () => {
    expect(tenantFundingSettingsSchema.safeParse(DEFAULT_TENANT_FUNDING_SETTINGS).success).toBe(true)
  })

  it('rejects an unknown billing model', () => {
    const bad = { ...DEFAULT_TENANT_FUNDING_SETTINGS, subventionBillingModel: 'WHENEVER' }
    expect(tenantFundingSettingsSchema.safeParse(bad).success).toBe(false)
  })
})
