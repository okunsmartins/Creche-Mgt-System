import { describe, it, expect } from 'vitest'
import { buildInvoiceDrafts, totalNetCents } from '../invoice'

// Reinforces the "money for children" guarantee: grouping weeks into billing
// periods must never lose or invent cents, and the annually frequency (untested
// elsewhere) must bucket correctly.

describe('buildInvoiceDrafts — annually grouping', () => {
  it('produces one invoice per 12-month block from the start', () => {
    const d = buildInvoiceDrafts({
      frequency: 'annually',
      startISO: '2026-01-01',
      endISO: '2027-12-31',
      providerHourlyRateCents: 500,
      contractedDayHours: [8, 8, 8, 8, 8],
    })
    expect(d).toHaveLength(2)
    expect(d[0]!.periodStart).toBe('2026-01-01')
    // Second block starts in the 2027 window.
    expect(d[1]!.periodStart >= '2027-01-01').toBe(true)
  })
})

describe('buildInvoiceDrafts — grouping loses no cents (invariant)', () => {
  const cases = [
    { frequency: 'weekly' as const, rate: 613, hours: [7, 7, 7, 7, 6] },
    { frequency: 'fortnightly' as const, rate: 550, hours: [8, 8, 8, 8, 8] },
    { frequency: 'monthly' as const, rate: 725, hours: [6, 6, 6, 6, 6] },
  ]

  for (const c of cases) {
    it(`${c.frequency}: period totals == sum of their weeks, with NCS`, () => {
      const drafts = buildInvoiceDrafts({
        frequency: c.frequency,
        startISO: '2026-09-01',
        endISO: '2026-12-31',
        providerHourlyRateCents: c.rate,
        contractedDayHours: c.hours,
        ncs: { active: true, awardedHourlyRateCents: 214, awardedWeeklyHours: 45 },
      })
      expect(drafts.length).toBeGreaterThan(0)

      // Every period's totals equal the sum of its own weekly breakdown...
      for (const d of drafts) {
        const wGross = d.weeks.reduce((s, w) => s + w.grossParentCents, 0)
        const wNcs = d.weeks.reduce((s, w) => s + w.ncsSubsidyCents, 0)
        const wNet = d.weeks.reduce((s, w) => s + w.netParentCents, 0)
        expect(d.grossParentCents).toBe(wGross)
        expect(d.ncsSubsidyCents).toBe(wNcs)
        expect(d.netParentCents).toBe(wNet)
        // ...and the money identity holds (no ECCE, no discount here).
        expect(d.netParentCents).toBe(d.grossParentCents - d.ncsSubsidyCents)
        expect(d.netParentCents).toBeGreaterThanOrEqual(0)
      }

      // ...and grouping the same weeks a different way (all periods) totals the same
      // as summing every week once — no cents created or lost by the bucketing.
      const allWeeks = drafts.flatMap((d) => d.weeks)
      const weekNetTotal = allWeeks.reduce((s, w) => s + w.netParentCents, 0)
      expect(totalNetCents(drafts)).toBe(weekNetTotal)
    })
  }
})
