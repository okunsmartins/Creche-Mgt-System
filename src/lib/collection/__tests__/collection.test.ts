import { describe, it, expect } from 'vitest'
import {
  CHARGE_BASES,
  isChargeBasis,
  runRequiredChaperones,
  assessRunStaffing,
  computeCollectionCharge,
  normaliseDays,
  formatDays,
  validateCollectionMethod,
  validateCollectionRun,
  ENROLMENT_STATUSES,
  isEnrolmentStatus,
  canTransitionEnrolment,
  REGISTER_STATUSES,
  isRegisterStatus,
  canTransitionRegister,
  type CollectionRunInput,
} from '../collection'

describe('charge basis', () => {
  it('has the three configured bases', () => {
    expect(CHARGE_BASES).toEqual(['per_day', 'weekly', 'per_term'])
    expect(isChargeBasis('weekly')).toBe(true)
    expect(isChargeBasis('yearly')).toBe(false)
  })
})

describe('chaperone ratio (1:4 default)', () => {
  it('ceil of children / ratio', () => {
    expect(runRequiredChaperones(0)).toBe(0)
    expect(runRequiredChaperones(1)).toBe(1)
    expect(runRequiredChaperones(4)).toBe(1)
    expect(runRequiredChaperones(5)).toBe(2)
    expect(runRequiredChaperones(9)).toBe(3)
  })

  it('honours a custom ratio', () => {
    expect(runRequiredChaperones(10, 5)).toBe(2)
  })

  it('assesses run staffing', () => {
    const under = assessRunStaffing(10, 2) // need 3, have 2
    expect(under.requiredChaperones).toBe(3)
    expect(under.ratioMet).toBe(false)
    expect(under.spareCapacity).toBe(0)

    const ok = assessRunStaffing(6, 2) // need 2, have 2, cap 8
    expect(ok.ratioMet).toBe(true)
    expect(ok.spareCapacity).toBe(2)
  })
})

describe('computeCollectionCharge', () => {
  it('multiplies price by units', () => {
    expect(computeCollectionCharge(1000)).toBe(1000) // default 1 unit
    expect(computeCollectionCharge(1000, 3)).toBe(3000)
    expect(computeCollectionCharge(1000, 0)).toBe(0)
  })
  it('never negative; floors/rounds inputs', () => {
    expect(computeCollectionCharge(-500, 2)).toBe(0)
    expect(computeCollectionCharge(1000, -1)).toBe(0)
    expect(computeCollectionCharge(999.6, 2)).toBe(2000)
  })
})

describe('days of week', () => {
  it('normalises: unique, in-range, sorted', () => {
    expect(normaliseDays([5, 1, 1, 3, 9, 0])).toEqual([1, 3, 5])
    expect(normaliseDays([])).toEqual([])
  })
  it('formats to labels', () => {
    expect(formatDays([1, 3, 5])).toBe('Mon, Wed, Fri')
    expect(formatDays([])).toBe('—')
  })
})

describe('validateCollectionMethod', () => {
  it('requires a label', () => {
    expect(validateCollectionMethod({ label: ' ' }).ok).toBe(false)
    expect(validateCollectionMethod({ label: 'Minibus' }).ok).toBe(true)
  })
})

describe('validateCollectionRun', () => {
  const base: CollectionRunInput = {
    name: 'After-school run',
    originSchoolName: 'St Brigid’s NS',
    days: [1, 2, 3, 4, 5],
    pickupTime: '14:30',
    capacity: 8,
    chargeBasis: 'per_day',
    priceCents: 1200,
  }

  it('accepts a valid run', () => {
    expect(validateCollectionRun(base).ok).toBe(true)
  })

  it('requires name, origin school and at least one day', () => {
    expect(validateCollectionRun({ ...base, name: '' }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, originSchoolName: '' }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, days: [] }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, days: [8, 9] }).ok).toBe(false)
  })

  it('validates pickup time, capacity, charge basis and price', () => {
    expect(validateCollectionRun({ ...base, pickupTime: '25:00' }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, pickupTime: '2:3' }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, capacity: 0 }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, chargeBasis: 'yearly' }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, priceCents: -1 }).ok).toBe(false)
  })

  it('allows an empty pickup time', () => {
    expect(validateCollectionRun({ ...base, pickupTime: null }).ok).toBe(true)
  })

  it('rejects a bad custom ratio', () => {
    expect(validateCollectionRun({ ...base, childrenPerChaperone: 0 }).ok).toBe(false)
    expect(validateCollectionRun({ ...base, childrenPerChaperone: 4 }).ok).toBe(true)
  })
})

describe('enrolment status machine', () => {
  it('recognises valid statuses', () => {
    expect(ENROLMENT_STATUSES).toEqual(['requested', 'approved', 'declined', 'ended'])
    expect(isEnrolmentStatus('approved')).toBe(true)
    expect(isEnrolmentStatus('pending')).toBe(false)
  })

  it('allows review decisions and reinstatement', () => {
    expect(canTransitionEnrolment('requested', 'approved')).toBe(true)
    expect(canTransitionEnrolment('requested', 'declined')).toBe(true)
    expect(canTransitionEnrolment('approved', 'ended')).toBe(true)
    expect(canTransitionEnrolment('declined', 'approved')).toBe(true)
    expect(canTransitionEnrolment('ended', 'approved')).toBe(true)
  })

  it('forbids no-op and illegal moves', () => {
    expect(canTransitionEnrolment('approved', 'approved')).toBe(false)
    expect(canTransitionEnrolment('approved', 'requested')).toBe(false)
    expect(canTransitionEnrolment('ended', 'declined')).toBe(false)
  })
})

describe('collection register status machine', () => {
  it('recognises statuses', () => {
    expect(REGISTER_STATUSES).toEqual(['scheduled', 'collected', 'released', 'absent'])
    expect(isRegisterStatus('collected')).toBe(true)
    expect(isRegisterStatus('gone')).toBe(false)
  })

  it('follows the collection lifecycle with undo paths', () => {
    expect(canTransitionRegister('scheduled', 'collected')).toBe(true)
    expect(canTransitionRegister('scheduled', 'absent')).toBe(true)
    expect(canTransitionRegister('collected', 'released')).toBe(true)
    expect(canTransitionRegister('collected', 'scheduled')).toBe(true) // undo
    expect(canTransitionRegister('released', 'collected')).toBe(true) // undo
    expect(canTransitionRegister('absent', 'scheduled')).toBe(true) // undo
  })

  it('forbids illegal jumps', () => {
    expect(canTransitionRegister('scheduled', 'released')).toBe(false)
    expect(canTransitionRegister('released', 'absent')).toBe(false)
    expect(canTransitionRegister('collected', 'collected')).toBe(false)
  })
})
