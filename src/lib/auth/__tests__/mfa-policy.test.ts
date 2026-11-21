import { describe, it, expect } from 'vitest'
import {
  ADMIN_MFA_GRACE_DAYS,
  adminMfaDecision,
  mfaGraceDeadline,
  mfaRedirectFor,
  normaliseTotpCode,
  type AdminMfaState,
} from '../mfa-policy'

const LIVE = new Date('2026-11-22T00:00:00Z')
const at = (iso: string) => new Date(iso)
const state = (s: Partial<AdminMfaState>): AdminMfaState => ({
  currentLevel: 'aal1',
  nextLevel: 'aal1',
  privilegedSince: '2026-10-01T00:00:00Z',
  ...s,
})

describe('mfaGraceDeadline', () => {
  it('existing admins get 7 days from the day the rule went live', () => {
    expect(mfaGraceDeadline('2026-10-01T00:00:00Z', LIVE).toISOString()).toBe(
      '2026-11-29T00:00:00.000Z',
    )
  })
  it('admins added later get 7 days from when they became an admin', () => {
    expect(mfaGraceDeadline('2026-12-10T09:00:00Z', LIVE).toISOString()).toBe(
      '2026-12-17T09:00:00.000Z',
    )
  })
  it('falls back to the live date when the start is unknown or invalid', () => {
    expect(mfaGraceDeadline(null, LIVE).toISOString()).toBe('2026-11-29T00:00:00.000Z')
    expect(mfaGraceDeadline('not a date', LIVE).toISOString()).toBe('2026-11-29T00:00:00.000Z')
  })
})

describe('adminMfaDecision', () => {
  it('non-privileged accounts (parents, staff) are never affected', () => {
    expect(adminMfaDecision(null, at('2027-01-01T00:00:00Z'), LIVE)).toEqual({ kind: 'ok' })
  })
  it('set up and code entered this session → ok', () => {
    expect(
      adminMfaDecision(state({ nextLevel: 'aal2', currentLevel: 'aal2' }), at('2027-01-01'), LIVE),
    ).toEqual({ kind: 'ok' })
  })
  it('set up but only the password entered this session → ask for the code', () => {
    expect(
      adminMfaDecision(state({ nextLevel: 'aal2', currentLevel: 'aal1' }), at('2026-11-23'), LIVE),
    ).toEqual({ kind: 'verify' })
  })
  it('not set up, inside the grace period → allowed with days left', () => {
    const d = adminMfaDecision(state({}), at('2026-11-24T00:00:00Z'), LIVE)
    expect(d).toEqual({ kind: 'grace', daysLeft: 5, deadline: '2026-11-29T00:00:00.000Z' })
  })
  it('counts a part-day as a whole day, never 0', () => {
    expect(adminMfaDecision(state({}), at('2026-11-28T23:00:00Z'), LIVE)).toMatchObject({
      kind: 'grace',
      daysLeft: 1,
    })
  })
  it('first day shows the full grace period', () => {
    expect(adminMfaDecision(state({}), LIVE, LIVE)).toMatchObject({
      kind: 'grace',
      daysLeft: ADMIN_MFA_GRACE_DAYS,
    })
  })
  it('not set up, grace over → must set up', () => {
    expect(adminMfaDecision(state({}), at('2026-11-29T00:00:00Z'), LIVE)).toEqual({
      kind: 'setup',
    })
  })
})

describe('mfaRedirectFor', () => {
  it('only blocking decisions redirect', () => {
    expect(mfaRedirectFor({ kind: 'verify' })).toBe('/mfa/verify')
    expect(mfaRedirectFor({ kind: 'setup' })).toBe('/mfa/setup')
    expect(mfaRedirectFor({ kind: 'ok' })).toBeNull()
    expect(mfaRedirectFor({ kind: 'grace', daysLeft: 3, deadline: 'x' })).toBeNull()
  })
})

describe('normaliseTotpCode', () => {
  it('accepts 6 digits, with or without spaces', () => {
    expect(normaliseTotpCode('123456')).toBe('123456')
    expect(normaliseTotpCode(' 123 456 ')).toBe('123456')
  })
  it('rejects anything else', () => {
    for (const bad of ['12345', '1234567', 'abcdef', '', null, undefined])
      expect(normaliseTotpCode(bad)).toBeNull()
  })
})
