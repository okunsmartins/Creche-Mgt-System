import { describe, it, expect } from 'vitest'
import {
  NCS_UNIVERSAL_HOURLY_RATE_CENTS,
  DEFAULT_ECCE_CONFIG,
  computeWeekSubvention,
  computePeriodSubvention,
  type WeekInput,
} from '../subvention'

// A full-week attendance pattern helper: `days` operating days of `hours` each.
const week = (days: number, hours: number): number[] => Array.from({ length: days }, () => hours)

const ncsUniversal = (band = 45) => ({
  active: true,
  awardedHourlyRateCents: NCS_UNIVERSAL_HOURLY_RATE_CENTS,
  awardedWeeklyHours: band,
})

describe('computeWeekSubvention — worked example (design §3)', () => {
  // €6/hr, 40 hrs/week, term-time, ECCE (standard) + NCS universal €2.14, band 45.
  const result = computeWeekSubvention({
    providerHourlyRateCents: 600,
    dayHours: week(5, 8),
    isEcceTermWeek: true,
    ecce: { active: true, higherCapitation: false },
    ncs: ncsUniversal(),
  })

  it('zero-rates 15 ECCE hours and bills 25 to the parent', () => {
    expect(result.ecceHours).toBe(15)
    expect(result.billableHours).toBe(25)
    expect(result.grossParentCents).toBe(15000)
  })

  it('subsidises 25 hours of NCS at €2.14', () => {
    expect(result.ncsSubsidisedHours).toBe(25)
    expect(result.ncsSubsidyCents).toBe(5350)
  })

  it('parent pays €96.50 net', () => {
    expect(result.netParentCents).toBe(9650)
  })

  it('provider receives €69.00 ECCE capitation + €53.50 NCS subsidy', () => {
    expect(result.providerEcceCapitationCents).toBe(6900)
    expect(result.providerNcsSubsidyCents).toBe(5350)
  })
})

describe('computeWeekSubvention — single-scheme cases', () => {
  it('ECCE only: 15h free, remaining 25h billed with no subsidy', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 8),
      isEcceTermWeek: true,
      ecce: { active: true, higherCapitation: false },
      ncs: null,
    })
    expect(r.ecceHours).toBe(15)
    expect(r.grossParentCents).toBe(15000)
    expect(r.ncsSubsidyCents).toBe(0)
    expect(r.netParentCents).toBe(15000)
    expect(r.providerEcceCapitationCents).toBe(6900)
  })

  it('NCS only (no ECCE): all 40h billable, subsidised up to band', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 8),
      isEcceTermWeek: true,
      ecce: null,
      ncs: ncsUniversal(),
    })
    expect(r.ecceHours).toBe(0)
    expect(r.billableHours).toBe(40)
    expect(r.grossParentCents).toBe(24000)
    expect(r.ncsSubsidisedHours).toBe(40)
    expect(r.ncsSubsidyCents).toBe(8560) // 214 × 40
    expect(r.netParentCents).toBe(15440)
    expect(r.providerEcceCapitationCents).toBe(0)
  })

  it('neither scheme: parent pays full gross', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 8),
      isEcceTermWeek: true,
      ecce: null,
      ncs: null,
    })
    expect(r.netParentCents).toBe(24000)
    expect(r.ncsSubsidyCents).toBe(0)
    expect(r.providerEcceCapitationCents).toBe(0)
  })
})

describe('computeWeekSubvention — ECCE caps and term-time', () => {
  it('caps ECCE at 3 hours per day', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: [5], // one 5h day
      isEcceTermWeek: true,
      ecce: { active: true, higherCapitation: false },
      ncs: null,
    })
    expect(r.ecceHours).toBe(3)
    expect(r.billableHours).toBe(2)
  })

  it('caps ECCE at 15 hours per week even across 6 operating days', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(6, 3), // 6 × 3h = 18h of ECCE-eligible time
      isEcceTermWeek: true,
      ecce: { active: true, higherCapitation: false },
      ncs: null,
    })
    expect(r.ecceHours).toBe(DEFAULT_ECCE_CONFIG.maxHoursPerWeek) // 15
    expect(r.billableHours).toBe(3) // 18 total − 15 ECCE
  })

  it('outside ECCE term the award does not apply', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 8),
      isEcceTermWeek: false,
      ecce: { active: true, higherCapitation: false },
      ncs: null,
    })
    expect(r.ecceHours).toBe(0)
    expect(r.billableHours).toBe(40)
    expect(r.providerEcceCapitationCents).toBe(0)
  })

  it('applies higher capitation when the room qualifies', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 8),
      isEcceTermWeek: true,
      ecce: { active: true, higherCapitation: true },
      ncs: null,
    })
    expect(r.providerEcceCapitationCents).toBe(DEFAULT_ECCE_CONFIG.capitationHigherWeeklyCents) // 8025
  })
})

describe('computeWeekSubvention — NCS band and safety rules', () => {
  it('subsidises only up to the awarded band of hours', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: week(5, 5), // 25h billable
      isEcceTermWeek: false,
      ecce: null,
      ncs: ncsUniversal(20), // band 20
    })
    expect(r.ncsSubsidisedHours).toBe(20)
    expect(r.ncsSubsidyCents).toBe(4280) // 214 × 20
  })

  it('never lets the subsidy exceed the fee (no profit) or the net go negative', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 600,
      dayHours: [10],
      isEcceTermWeek: false,
      ecce: null,
      ncs: { active: true, awardedHourlyRateCents: 700, awardedWeeklyHours: 45 },
    })
    // raw subsidy 700×10 = 7000, but fee is only 600×10 = 6000
    expect(r.grossParentCents).toBe(6000)
    expect(r.ncsSubsidyCents).toBe(6000)
    expect(r.netParentCents).toBe(0)
  })
})

describe('computeWeekSubvention — fractional hours round to whole cents', () => {
  it('rounds rate × fractional hours to the nearest cent', () => {
    const r = computeWeekSubvention({
      providerHourlyRateCents: 617,
      dayHours: [2.5], // 617 × 2.5 = 1542.5 → 1543
      isEcceTermWeek: false,
      ecce: null,
      ncs: null,
    })
    expect(r.grossParentCents).toBe(1543)
    expect(Number.isInteger(r.grossParentCents)).toBe(true)
  })
})

describe('computePeriodSubvention', () => {
  const wk: WeekInput = {
    providerHourlyRateCents: 600,
    dayHours: week(5, 8),
    isEcceTermWeek: true,
    ecce: { active: true, higherCapitation: false },
    ncs: ncsUniversal(),
  }

  it('sums weeks exactly with no orphan cents', () => {
    const p = computePeriodSubvention([wk, wk, wk])
    expect(p.grossParentCents).toBe(45000)
    expect(p.ncsSubsidyCents).toBe(16050)
    expect(p.netParentCents).toBe(28950)
    expect(p.providerReceivableEcceCents).toBe(20700) // 3 × 6900
    expect(p.providerReceivableNcsCents).toBe(16050)
    // identity: net + subsidy == gross (no discount)
    expect(p.netParentCents + p.ncsSubsidyCents).toBe(p.grossParentCents)
  })

  it('applies an invoice-level discount without going negative', () => {
    const p = computePeriodSubvention([wk], { discountCents: 5000 })
    // week net is 9650; discount 5000 → 4650
    expect(p.discountCents).toBe(5000)
    expect(p.netParentCents).toBe(4650)
  })

  it('clamps a discount larger than the balance', () => {
    const p = computePeriodSubvention([wk], { discountCents: 999999 })
    expect(p.netParentCents).toBe(0)
    expect(p.discountCents).toBe(9650) // == after-subsidy balance
  })

  it('property: for varied inputs, net = gross − subsidy − discount ≥ 0 and stays integer', () => {
    const rates = [300, 617, 1000]
    const bands = [10, 20, 45]
    for (const rate of rates) {
      for (const band of bands) {
        for (const hrs of [3, 6.5, 8]) {
          const p = computePeriodSubvention([
            {
              providerHourlyRateCents: rate,
              dayHours: week(5, hrs),
              isEcceTermWeek: true,
              ecce: { active: true, higherCapitation: false },
              ncs: ncsUniversal(band),
            },
          ])
          expect(p.netParentCents).toBe(p.grossParentCents - p.ncsSubsidyCents - p.discountCents)
          expect(p.netParentCents).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(p.netParentCents)).toBe(true)
          expect(Number.isInteger(p.ncsSubsidyCents)).toBe(true)
        }
      }
    }
  })
})
