import { describe, it, expect } from 'vitest'
import {
  CLAIM_STATUSES,
  isClaimStatus,
  canTransitionClaim,
  copaymentMandatory,
  computeCopayment,
  claimedMinutesForWeek,
  validateClaimReady,
  reconcileCopayment,
} from '../copayment'

describe('claim status machine', () => {
  it('recognises statuses', () => {
    expect(CLAIM_STATUSES).toEqual([
      'DRAFT',
      'READY',
      'VERIFIED',
      'SUBMITTED_EXTERNALLY',
      'SUPERSEDED',
    ])
    expect(isClaimStatus('READY')).toBe(true)
    expect(isClaimStatus('PENDING')).toBe(false)
  })

  it('follows the lifecycle with edit step-backs and supersede from anywhere live', () => {
    expect(canTransitionClaim('DRAFT', 'READY')).toBe(true)
    expect(canTransitionClaim('READY', 'VERIFIED')).toBe(true)
    expect(canTransitionClaim('READY', 'DRAFT')).toBe(true) // edit
    expect(canTransitionClaim('VERIFIED', 'SUBMITTED_EXTERNALLY')).toBe(true)
    expect(canTransitionClaim('VERIFIED', 'READY')).toBe(true) // edit
    expect(canTransitionClaim('SUBMITTED_EXTERNALLY', 'SUPERSEDED')).toBe(true)
  })

  it('forbids no-ops and illegal jumps', () => {
    expect(canTransitionClaim('DRAFT', 'VERIFIED')).toBe(false)
    expect(canTransitionClaim('DRAFT', 'SUBMITTED_EXTERNALLY')).toBe(false)
    expect(canTransitionClaim('SUBMITTED_EXTERNALLY', 'VERIFIED')).toBe(false)
    expect(canTransitionClaim('SUPERSEDED', 'DRAFT')).toBe(false)
    expect(canTransitionClaim('READY', 'READY')).toBe(false)
  })
})

describe('computeCopayment', () => {
  it('fee minus NCS, ECCE and discounts, floored at zero', () => {
    expect(
      computeCopayment({
        weeklyFeeCents: 24000,
        ncsSubsidyCents: 8560,
        ecceSubsidyCents: 6900,
        discountCents: 1000,
      }),
    ).toBe(24000 - 8560 - 6900 - 1000)
  })
  it('never negative; treats missing subsidies as zero', () => {
    expect(computeCopayment({ weeklyFeeCents: 10000 })).toBe(10000)
    expect(computeCopayment({ weeklyFeeCents: 5000, ncsSubsidyCents: 9000 })).toBe(0)
  })
})

describe('claimedMinutesForWeek (term vs non-term)', () => {
  it('picks the pattern for the week type', () => {
    const p = { termMinutes: 2400, nonTermMinutes: 1500 }
    expect(claimedMinutesForWeek(p, true)).toBe(2400)
    expect(claimedMinutesForWeek(p, false)).toBe(1500)
  })
})

describe('copaymentMandatory + validateClaimReady', () => {
  it('co-payment mandatory from 31 July 2026', () => {
    expect(copaymentMandatory('2026-07-30')).toBe(false)
    expect(copaymentMandatory('2026-07-31')).toBe(true)
    expect(copaymentMandatory('2026-09-01')).toBe(true)
  })

  it('a valid claim passes', () => {
    expect(
      validateClaimReady({
        weeklyFeeCents: 24000,
        termMinutes: 2400,
        nonTermMinutes: 0,
        startDate: '2026-09-01',
      }).ok,
    ).toBe(true)
  })

  it('blocks READY and lists exact missing fields', () => {
    const r = validateClaimReady({
      weeklyFeeCents: 0,
      termMinutes: 0,
      nonTermMinutes: 0,
      startDate: '2026-09-01',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.missing).toContain('Weekly claimed hours (term or non-term)')
      expect(r.missing).toContain('Weekly fee (required for the co-payment)')
    }
  })

  it('pre-31-Jul-2026 claim does not require the fee', () => {
    expect(
      validateClaimReady({
        weeklyFeeCents: 0,
        termMinutes: 2400,
        nonTermMinutes: 0,
        startDate: '2026-07-30',
      }).ok,
    ).toBe(true)
  })

  it('a claim edited into the mandatory window requires the fee', () => {
    const r = validateClaimReady({
      weeklyFeeCents: 0,
      termMinutes: 2400,
      nonTermMinutes: 0,
      startDate: '2026-08-15',
    })
    expect(r.ok).toBe(false)
  })
})

describe('reconcileCopayment', () => {
  it('matches within tolerance, flags beyond it', () => {
    expect(reconcileCopayment(15440, 15440).matches).toBe(true)
    expect(reconcileCopayment(15440, 15450, 50).matches).toBe(true)
    const m = reconcileCopayment(15440, 16000)
    expect(m.matches).toBe(false)
    expect(m.differenceCents).toBe(-560)
  })
})
