import { describe, it, expect } from 'vitest'
import {
  AIM_LEVELS,
  AIM_STATUSES,
  AIM_CONSENT_STATUSES,
  isAimLevel,
  canTransitionAim,
  consentAllowsPreparation,
  validateAimReady,
} from '../aim'

describe('AIM levels', () => {
  it('are 1 through 7', () => {
    expect(AIM_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(isAimLevel(7)).toBe(true)
    expect(isAimLevel(0)).toBe(false)
    expect(isAimLevel(8)).toBe(false)
  })
})

describe('AIM status machine', () => {
  it('follows PREPARING → CONSENT_RECORDED → READY → SUBMITTED_EXTERNALLY', () => {
    expect(canTransitionAim('PREPARING', 'CONSENT_RECORDED')).toBe(true)
    expect(canTransitionAim('CONSENT_RECORDED', 'READY')).toBe(true)
    expect(canTransitionAim('READY', 'SUBMITTED_EXTERNALLY')).toBe(true)
  })

  it('cannot skip straight from PREPARING to READY', () => {
    expect(canTransitionAim('PREPARING', 'READY')).toBe(false)
  })

  it('allows stepping back for edits but CLOSED is terminal', () => {
    expect(canTransitionAim('READY', 'CONSENT_RECORDED')).toBe(true)
    expect(canTransitionAim('CONSENT_RECORDED', 'PREPARING')).toBe(true)
    for (const s of AIM_STATUSES) expect(canTransitionAim('CLOSED', s)).toBe(false)
  })

  it('any live state can be closed, and no self-transition', () => {
    expect(canTransitionAim('PREPARING', 'CLOSED')).toBe(true)
    expect(canTransitionAim('SUBMITTED_EXTERNALLY', 'CLOSED')).toBe(true)
    expect(canTransitionAim('READY', 'READY')).toBe(false)
  })
})

describe('consent gate', () => {
  it('only GRANTED allows preparation', () => {
    expect(consentAllowsPreparation('GRANTED')).toBe(true)
    for (const c of AIM_CONSENT_STATUSES.filter((s) => s !== 'GRANTED'))
      expect(consentAllowsPreparation(c)).toBe(false)
  })
})

describe('validateAimReady', () => {
  const good = { level: 7, consentStatus: 'GRANTED' as const, supportSummary: 'In-room support.' }

  it('passes with level + granted consent + summary', () => {
    expect(validateAimReady(good)).toEqual({ ok: true })
  })

  it('blocks without consent and names it', () => {
    const r = validateAimReady({ ...good, consentStatus: 'REQUESTED' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toContain('Recorded parental/guardian consent (granted)')
  })

  it('blocks without a support summary', () => {
    const r = validateAimReady({ ...good, supportSummary: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toContain('Support summary')
  })

  it('blocks without a valid level', () => {
    const r = validateAimReady({ ...good, level: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toContain('AIM level (1–7)')
  })

  it('lists every missing prerequisite at once', () => {
    const r = validateAimReady({ level: null, consentStatus: 'DECLINED', supportSummary: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toHaveLength(3)
  })
})
