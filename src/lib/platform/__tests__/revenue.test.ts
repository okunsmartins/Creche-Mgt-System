import { describe, it, expect } from 'vitest'
import { pastTrialConversion, funnelFromRows } from '../revenue'
import { monthlyCentsFromItems } from '../stripeMrr'
import type { SchoolOverviewRow } from '../schools'

function row(partial: Partial<SchoolOverviewRow>): SchoolOverviewRow {
  return {
    id: 'id',
    name: 'School',
    subdomain: null,
    createdAt: '2026-01-01T00:00:00Z',
    plan: 'pro',
    status: 'active',
    hasAccess: true,
    smsEnabled: false,
    trialEndsAt: null,
    studentsCount: 0,
    collectedCents: 0,
    isActive: true,
    ...partial,
  }
}

describe('pastTrialConversion', () => {
  it('is active / (active + churned) as a rounded %', () => {
    expect(pastTrialConversion(3, 1)).toBe(75)
    expect(pastTrialConversion(1, 2)).toBe(33)
    expect(pastTrialConversion(5, 0)).toBe(100)
  })
  it('is null when nobody is past trial', () => {
    expect(pastTrialConversion(0, 0)).toBeNull()
  })
})

describe('funnelFromRows', () => {
  it('counts by status; churned = cancelled + incomplete; none excluded', () => {
    const rows = [
      row({ status: 'trialing' }),
      row({ status: 'active' }),
      row({ status: 'active' }),
      row({ status: 'past_due' }),
      row({ status: 'cancelled' }),
      row({ status: 'incomplete' }),
      row({ status: 'none' }),
    ]
    expect(funnelFromRows(rows)).toEqual({ trialing: 1, active: 2, pastDue: 1, churned: 2 })
  })
})

describe('monthlyCentsFromItems', () => {
  it('sums monthly prices as-is', () => {
    expect(monthlyCentsFromItems([{ unitAmount: 3999, interval: 'month', quantity: 1 }])).toBe(3999)
  })
  it('normalizes annual to monthly', () => {
    // €420/yr → €35/mo = 3500 cents
    expect(monthlyCentsFromItems([{ unitAmount: 42000, interval: 'year', quantity: 1 }])).toBe(3500)
  })
  it('respects quantity and sums multiple items', () => {
    expect(
      monthlyCentsFromItems([
        { unitAmount: 4499, interval: 'month', quantity: 2 },
        { unitAmount: 42000, interval: 'year', quantity: 1 },
      ]),
    ).toBe(4499 * 2 + 3500)
  })
  it('ignores items with no unit amount', () => {
    expect(monthlyCentsFromItems([{ unitAmount: null, interval: 'month', quantity: 1 }])).toBe(0)
  })
})
