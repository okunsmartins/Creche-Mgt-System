import { describe, it, expect } from 'vitest'
import {
  ncsEligibleMinutes,
  isUnderAttended,
  advanceWeek,
  runSequence,
  EMPTY_SEQUENCE,
  type WeekInput,
} from '../ncs-compliance'
import {
  NCS_RULES_2026,
  resolveNcsRules,
  ncsRulesByVersion,
  CURRENT_NCS_RULES_VERSION,
} from '../rules'

const RULES = NCS_RULES_2026

// A compliant week: attended exactly the claimed hours (2400 min = 40 h).
const OK: WeekInput = { ncsAttendedMinutes: 2400, claimedMinutes: 2400, fullWeekAbsent: false }
// Under-attended week: attended less than claimed.
const UNDER: WeekInput = { ncsAttendedMinutes: 1800, claimedMinutes: 2400, fullWeekAbsent: false }
// Full-week absence.
const ABSENT: WeekInput = { ncsAttendedMinutes: 0, claimedMinutes: 2400, fullWeekAbsent: true }

describe('ncsEligibleMinutes (exclude ECCE/non-subsidised hours)', () => {
  it('subtracts excluded minutes and never goes negative', () => {
    expect(ncsEligibleMinutes(2400, 600)).toBe(1800)
    expect(ncsEligibleMinutes(600, 1000)).toBe(0)
    expect(ncsEligibleMinutes(2400)).toBe(2400)
  })
})

describe('isUnderAttended', () => {
  it('is true when attended < claimed', () => {
    expect(isUnderAttended(1800, 2400)).toBe(true)
    expect(isUnderAttended(2400, 2400)).toBe(false)
    expect(isUnderAttended(2500, 2400)).toBe(false)
  })
  it('cannot under-attend when nothing is claimed', () => {
    expect(isUnderAttended(0, 0)).toBe(false)
  })
})

describe('advanceWeek — single-week transitions', () => {
  it('a compliant week resets both counters', () => {
    const r = advanceWeek(
      { consecutiveUnderAttendanceWeeks: 5, consecutiveAbsenceWeeks: 2 },
      OK,
      RULES,
    )
    expect(r.consecutiveUnderAttendanceWeeks).toBe(0)
    expect(r.consecutiveAbsenceWeeks).toBe(0)
    expect(r.thresholdEvent).toBe('NONE')
    expect(r.underAttended).toBe(false)
  })

  it('an absent week increments both under and absence counters', () => {
    const r = advanceWeek(
      { consecutiveUnderAttendanceWeeks: 1, consecutiveAbsenceWeeks: 1 },
      ABSENT,
      RULES,
    )
    expect(r.consecutiveAbsenceWeeks).toBe(2)
    expect(r.consecutiveUnderAttendanceWeeks).toBe(2)
    expect(r.underAttended).toBe(true)
    expect(r.fullWeekAbsent).toBe(true)
  })

  it('a partial week increments under but resets absence', () => {
    const r = advanceWeek(
      { consecutiveUnderAttendanceWeeks: 1, consecutiveAbsenceWeeks: 3 },
      UNDER,
      RULES,
    )
    expect(r.consecutiveUnderAttendanceWeeks).toBe(2)
    expect(r.consecutiveAbsenceWeeks).toBe(0)
  })
})

describe('threshold events', () => {
  it('fires ABSENCE_4 on the 4th consecutive full-week absence', () => {
    const results = runSequence([ABSENT, ABSENT, ABSENT, ABSENT], RULES)
    expect(results.map((r) => r.thresholdEvent)).toEqual(['NONE', 'NONE', 'NONE', 'ABSENCE_4'])
    expect(results[3]!.consecutiveAbsenceWeeks).toBe(4)
  })

  it('fires UNDER_8 on the 8th consecutive under-attendance week', () => {
    const results = runSequence(Array(8).fill(UNDER), RULES)
    expect(results[6]!.thresholdEvent).toBe('NONE')
    expect(results[7]!.thresholdEvent).toBe('UNDER_8')
    expect(results[7]!.consecutiveUnderAttendanceWeeks).toBe(8)
  })

  it('escalates to UNDER_12 when under-attendance continues to week 12', () => {
    const results = runSequence(Array(12).fill(UNDER), RULES)
    expect(results[7]!.thresholdEvent).toBe('UNDER_8')
    expect(results[11]!.thresholdEvent).toBe('UNDER_12')
  })

  it('a compliant week mid-run resets the sequence (no threshold)', () => {
    const results = runSequence([UNDER, UNDER, UNDER, OK, UNDER, UNDER], RULES)
    expect(results[3]!.consecutiveUnderAttendanceWeeks).toBe(0)
    expect(results[5]!.consecutiveUnderAttendanceWeeks).toBe(2)
    expect(results.every((r) => r.thresholdEvent === 'NONE')).toBe(true)
  })
})

describe('pre-threshold risk (weeks 6 and 7 before the 8-week action)', () => {
  it('raises approaching-risk at weeks 6 and 7, not before, not at 8', () => {
    const results = runSequence(Array(8).fill(UNDER), RULES)
    expect(results[4]!.riskState).toBe('NONE') // week 5
    expect(results[5]!.riskState).toBe('APPROACHING_UNDER_ATTENDANCE') // week 6
    expect(results[5]!.weeksUntilUnderThreshold).toBe(2)
    expect(results[6]!.riskState).toBe('APPROACHING_UNDER_ATTENDANCE') // week 7
    expect(results[6]!.weeksUntilUnderThreshold).toBe(1)
    expect(results[7]!.riskState).toBe('NONE') // week 8 is the action, not a risk
    expect(results[7]!.thresholdEvent).toBe('UNDER_8')
  })
})

describe('service closure handling', () => {
  it('a paused closure week carries the counters and emits nothing', () => {
    const prior = { consecutiveUnderAttendanceWeeks: 3, consecutiveAbsenceWeeks: 0 }
    const r = advanceWeek(prior, { ...ABSENT, serviceClosed: true }, RULES)
    expect(r.closureEffect).toBe('PAUSE_SEQUENCE')
    expect(r.consecutiveUnderAttendanceWeeks).toBe(3) // unchanged
    expect(r.thresholdEvent).toBe('NONE')
  })

  it('sequence resumes after a closure rather than resetting', () => {
    const results = runSequence([UNDER, UNDER, UNDER, { ...OK, serviceClosed: true }, UNDER], RULES)
    // closure week (index 3) holds at 3; the next under week continues to 4.
    expect(results[3]!.consecutiveUnderAttendanceWeeks).toBe(3)
    expect(results[4]!.consecutiveUnderAttendanceWeeks).toBe(4)
  })
})

describe('rules versioning', () => {
  it('resolves the current rules and reproduces them by version', () => {
    expect(resolveNcsRules('2026/2027')).toEqual(NCS_RULES_2026)
    expect(ncsRulesByVersion(CURRENT_NCS_RULES_VERSION)).toEqual(NCS_RULES_2026)
    expect(ncsRulesByVersion('does-not-exist')).toBeNull()
  })

  it('a historic sequence recomputes identically from the same rules version', () => {
    const weeks = Array(8).fill(UNDER)
    const a = runSequence(weeks, ncsRulesByVersion(CURRENT_NCS_RULES_VERSION)!)
    const b = runSequence(weeks, ncsRulesByVersion(CURRENT_NCS_RULES_VERSION)!)
    expect(a).toEqual(b)
    expect(a[7]!.thresholdEvent).toBe('UNDER_8')
  })
})

describe('empty-sequence constant', () => {
  it('starts both counters at zero', () => {
    expect(EMPTY_SEQUENCE).toEqual({
      consecutiveUnderAttendanceWeeks: 0,
      consecutiveAbsenceWeeks: 0,
    })
  })
})
