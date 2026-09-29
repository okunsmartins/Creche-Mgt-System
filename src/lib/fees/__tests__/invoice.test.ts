import { describe, it, expect } from 'vitest'
import { buildInvoiceDrafts, totalNetCents } from '../invoice'

describe('buildInvoiceDrafts — flat fee (no subvention)', () => {
  it('monthly flat fee yields one equal invoice per calendar month', () => {
    const drafts = buildInvoiceDrafts({
      frequency: 'monthly',
      startISO: '2026-01-01',
      endISO: '2026-12-31',
      flatAmountCents: 24000,
    })
    expect(drafts).toHaveLength(12)
    expect(drafts.every((d) => d.netParentCents === 24000)).toBe(true)
    expect(drafts.every((d) => d.grossParentCents === 24000)).toBe(true)
    expect(drafts.every((d) => d.ncsSubsidyCents === 0)).toBe(true)
    expect(totalNetCents(drafts)).toBe(12 * 24000)
  })

  it('empty when the window is inverted', () => {
    expect(
      buildInvoiceDrafts({ frequency: 'weekly', startISO: '2026-02-01', endISO: '2026-01-01', flatAmountCents: 1000 }),
    ).toEqual([])
  })
})

describe('buildInvoiceDrafts — hours based, no funding', () => {
  const base = {
    startISO: '2026-09-01',
    endISO: '2026-09-28', // 4 operating weeks: Sep 1, 8, 15, 22
    providerHourlyRateCents: 600, // €6/hr
    contractedDayHours: [8, 8, 8, 8, 8], // 40 hrs/week → €240/week gross
  }

  it('weekly → one invoice per week at the gross fee', () => {
    const d = buildInvoiceDrafts({ ...base, frequency: 'weekly' })
    expect(d).toHaveLength(4)
    expect(d.every((x) => x.grossParentCents === 24000 && x.netParentCents === 24000)).toBe(true)
    expect(d[0]!.periodStart).toBe('2026-09-01')
    expect(d[0]!.periodEnd).toBe('2026-09-07')
    expect(d[0]!.dueDate).toBe('2026-09-01')
  })

  it('fortnightly → groups two weeks per invoice', () => {
    const d = buildInvoiceDrafts({ ...base, frequency: 'fortnightly' })
    expect(d).toHaveLength(2)
    expect(d.every((x) => x.grossParentCents === 48000 && x.netParentCents === 48000)).toBe(true)
  })

  it('monthly → groups the month’s weeks into one invoice', () => {
    const d = buildInvoiceDrafts({ ...base, frequency: 'monthly' })
    expect(d).toHaveLength(1)
    expect(d[0]!.grossParentCents).toBe(4 * 24000)
    expect(d[0]!.netParentCents).toBe(4 * 24000)
  })
})

describe('buildInvoiceDrafts — NCS universal subsidy', () => {
  it('nets the NCS subsidy off each weekly invoice', () => {
    const d = buildInvoiceDrafts({
      frequency: 'weekly',
      startISO: '2026-09-01',
      endISO: '2026-09-28',
      providerHourlyRateCents: 600,
      contractedDayHours: [8, 8, 8, 8, 8], // 40 billable hrs
      ncs: { active: true, awardedHourlyRateCents: 214, awardedWeeklyHours: 45 },
    })
    expect(d).toHaveLength(4)
    // subsidy = 214 × min(40,45) = 8560; net = 24000 − 8560 = 15440
    expect(d[0]!.ncsSubsidisedHours).toBe(40)
    expect(d[0]!.ncsSubsidyCents).toBe(8560)
    expect(d[0]!.netParentCents).toBe(15440)
    expect(d[0]!.providerReceivableNcsCents).toBe(8560)
    expect(totalNetCents(d)).toBe(4 * 15440)
  })
})

describe('buildInvoiceDrafts — ECCE zero-rating', () => {
  it('zero-rates ECCE hours and accrues provider capitation (term weeks)', () => {
    const d = buildInvoiceDrafts({
      frequency: 'monthly',
      startISO: '2026-09-01',
      endISO: '2026-09-28', // 4 term weeks
      providerHourlyRateCents: 600,
      contractedDayHours: [8, 8, 8, 8, 8], // 40 hrs; ECCE zero-rates 15/wk
      ecce: { active: true, higherCapitation: false },
    })
    expect(d).toHaveLength(1)
    // Per week: billable = 40 − 15 = 25 hrs → €150 gross; capitation €69.
    expect(d[0]!.grossParentCents).toBe(4 * 15000)
    expect(d[0]!.ecceZeroRatedHours).toBe(4 * 15)
    expect(d[0]!.providerReceivableEcceCents).toBe(4 * 6900)
    expect(d[0]!.netParentCents).toBe(4 * 15000)
  })

  it('does NOT zero-rate weeks outside the ECCE term calendar', () => {
    const d = buildInvoiceDrafts({
      frequency: 'weekly',
      startISO: '2026-09-01',
      endISO: '2026-09-14', // 2 weeks: Sep 1 (term), Sep 8 (not term)
      providerHourlyRateCents: 600,
      contractedDayHours: [8, 8, 8, 8, 8],
      ecce: { active: true, higherCapitation: false },
      ecceTermWeekStarts: ['2026-09-01'], // only the first week is a term week
    })
    expect(d).toHaveLength(2)
    // Week 1 (term): billable 25 → €150. Week 2 (non-term): billable 40 → €240.
    expect(d[0]!.grossParentCents).toBe(15000)
    expect(d[0]!.ecceZeroRatedHours).toBe(15)
    expect(d[1]!.grossParentCents).toBe(24000)
    expect(d[1]!.ecceZeroRatedHours).toBe(0)
  })
})
