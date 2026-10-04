import { describe, it, expect } from 'vitest'
import { ECCE_SESSIONS, isEcceSession, isValidEircode, validateEcceReady } from '../ecce'
import {
  READINESS_STATUSES,
  isReadinessStatus,
  isOutstanding,
  readinessSummary,
  PROGRAMME_READINESS_2026_2027,
  type ReadinessStatus,
} from '../readiness'

describe('ECCE session + Eircode', () => {
  it('knows the sessions', () => {
    expect(ECCE_SESSIONS).toEqual(['AM', 'PM', 'OTHER'])
    expect(isEcceSession('AM')).toBe(true)
    expect(isEcceSession('EVENING')).toBe(false)
  })
  it('format-checks Eircodes', () => {
    expect(isValidEircode('D02 AF30')).toBe(true)
    expect(isValidEircode('D02AF30')).toBe(true)
    expect(isValidEircode('nope')).toBe(false)
  })
})

describe('validateEcceReady', () => {
  const base = {
    ppsnPresent: true,
    addressPresent: true,
    registrationPeriodSet: true,
    session: 'AM' as string | null,
    aimLevel7: false,
  }
  it('accepts a complete registration', () => {
    expect(validateEcceReady(base).ok).toBe(true)
  })
  it('lists missing core fields', () => {
    const r = validateEcceReady({
      ...base,
      ppsnPresent: false,
      addressPresent: false,
      registrationPeriodSet: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.missing).toContain('Child PPSN')
      expect(r.missing).toContain('Address')
      expect(r.missing).toContain('Registration period')
    }
  })
  it('AIM Level 7 requires a confirmed AM/PM session', () => {
    expect(validateEcceReady({ ...base, aimLevel7: true, session: 'OTHER' }).ok).toBe(false)
    expect(validateEcceReady({ ...base, aimLevel7: true, session: null }).ok).toBe(false)
    expect(validateEcceReady({ ...base, aimLevel7: true, session: 'PM' }).ok).toBe(true)
  })
  it('flags an invalid Eircode when provided', () => {
    expect(validateEcceReady({ ...base, eircode: 'bad' }).ok).toBe(false)
    expect(validateEcceReady({ ...base, eircode: 'D02 AF30' }).ok).toBe(true)
  })
})

describe('Programme Readiness', () => {
  it('has the 2026/2027 checklist with the required items', () => {
    const keys = PROGRAMME_READINESS_2026_2027.map((i) => i.key)
    for (const k of [
      'organisation_details',
      'primary_authorised_user',
      'bank_account',
      'tusla_registration',
      'fee_table',
      'service_calendar',
      'parent_statement',
    ]) {
      expect(keys).toContain(k)
    }
  })

  it('status helpers', () => {
    expect(READINESS_STATUSES).toContain('REVIEW_REQUIRED')
    expect(isReadinessStatus('MISSING')).toBe(true)
    expect(isReadinessStatus('NOPE')).toBe(false)
    expect(isOutstanding('MISSING')).toBe(true)
    expect(isOutstanding('REVIEW_REQUIRED')).toBe(true)
    expect(isOutstanding('CURRENT')).toBe(false)
    expect(isOutstanding('SUBMITTED')).toBe(false)
  })

  it('summarises a checklist', () => {
    const items: { status: ReadinessStatus }[] = [
      { status: 'CURRENT' },
      { status: 'MISSING' },
      { status: 'REVIEW_REQUIRED' },
      { status: 'SUBMITTED' },
      { status: 'NOT_APPLICABLE' },
    ]
    const s = readinessSummary(items)
    expect(s).toEqual({ total: 5, outstanding: 2, current: 1, submitted: 1, notApplicable: 1 })
  })
})
