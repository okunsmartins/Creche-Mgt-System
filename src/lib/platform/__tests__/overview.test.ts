import { describe, it, expect } from 'vitest'
import {
  estimateMonthlyCents,
  summarizeSchools,
  attentionFromRows,
  monthStartIso,
} from '../overview'
import type { SchoolOverviewRow } from '../schools'

const NOW = new Date('2026-06-15T12:00:00Z')
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

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

describe('estimateMonthlyCents', () => {
  it('counts an active school at the single plan price (7499)', () => {
    expect(estimateMonthlyCents({ status: 'active' })).toBe(7499)
  })

  it('counts trials / past_due / none as 0 (not yet paying)', () => {
    expect(estimateMonthlyCents({ status: 'trialing' })).toBe(0)
    expect(estimateMonthlyCents({ status: 'past_due' })).toBe(0)
    expect(estimateMonthlyCents({ status: 'none' })).toBe(0)
  })
})

describe('summarizeSchools', () => {
  it('counts by subscription state', () => {
    const rows = [
      row({ status: 'active', hasAccess: true }),
      row({ status: 'trialing', hasAccess: true }),
      row({ status: 'trialing', hasAccess: true }),
      row({ status: 'past_due', hasAccess: true }),
      row({ status: 'cancelled', hasAccess: false }),
      row({ status: 'none', hasAccess: false }),
    ]
    expect(summarizeSchools(rows)).toEqual({
      total: 6,
      withAccess: 4, // active + 2 trialing + past_due(in grace)
      trialing: 2,
      paid: 1,
      free: 2, // cancelled + none
    })
  })
})

describe('attentionFromRows', () => {
  it('flags trials ending within 7 days and all past_due', () => {
    const rows = [
      row({ id: 'a', name: 'Soon', status: 'trialing', trialEndsAt: daysFromNow(3) }),
      row({ id: 'b', name: 'Later', status: 'trialing', trialEndsAt: daysFromNow(20) }),
      row({ id: 'c', name: 'Expired', status: 'trialing', trialEndsAt: daysFromNow(-1) }),
      row({ id: 'd', name: 'Overdue', status: 'past_due' }),
    ]
    const { trialsExpiringSoon, pastDue } = attentionFromRows(rows, NOW)
    expect(trialsExpiringSoon.map((s) => s.id)).toEqual(['a'])
    expect(pastDue.map((s) => s.id)).toEqual(['d'])
  })

  it('sorts expiring trials by soonest first', () => {
    const rows = [
      row({ id: 'x', name: 'X', status: 'trialing', trialEndsAt: daysFromNow(5) }),
      row({ id: 'y', name: 'Y', status: 'trialing', trialEndsAt: daysFromNow(2) }),
    ]
    expect(attentionFromRows(rows, NOW).trialsExpiringSoon.map((s) => s.id)).toEqual(['y', 'x'])
  })
})

describe('monthStartIso', () => {
  it('returns the first of the month at UTC midnight', () => {
    expect(monthStartIso(new Date('2026-06-15T12:34:56Z'))).toBe('2026-06-01T00:00:00.000Z')
  })
})
