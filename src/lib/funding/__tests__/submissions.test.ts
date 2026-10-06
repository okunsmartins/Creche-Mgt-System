import { describe, it, expect } from 'vitest'
import {
  SUBMISSION_STATUSES,
  SUBMISSION_PAYLOAD_VERSION,
  canTransitionSubmission,
  buildWeeklyReturnPayload,
  type WeeklyReturnRow,
} from '../submissions'

const row = (id: string): WeeklyReturnRow => ({
  studentId: id,
  childName: id,
  claimedMinutes: 2400,
  actualMinutes: 0,
  consecutiveUnderWeeks: 8,
  consecutiveAbsenceWeeks: 0,
  thresholdEvent: 'UNDER_8',
  riskState: 'NONE',
})

describe('submission status machine', () => {
  it('prepared can be submitted or superseded', () => {
    expect(canTransitionSubmission('PREPARED', 'SUBMITTED_EXTERNALLY')).toBe(true)
    expect(canTransitionSubmission('PREPARED', 'SUPERSEDED')).toBe(true)
  })

  it('submitted can only be superseded; superseded is terminal; no self-transition', () => {
    expect(canTransitionSubmission('SUBMITTED_EXTERNALLY', 'SUPERSEDED')).toBe(true)
    expect(canTransitionSubmission('SUBMITTED_EXTERNALLY', 'PREPARED')).toBe(false)
    for (const s of SUBMISSION_STATUSES)
      expect(canTransitionSubmission('SUPERSEDED', s)).toBe(false)
    expect(canTransitionSubmission('PREPARED', 'PREPARED')).toBe(false)
  })
})

describe('buildWeeklyReturnPayload', () => {
  it('stamps version + kind and counts review rows', () => {
    const p = buildWeeklyReturnPayload({
      weekStart: '2026-09-28',
      calculationVersion: 'ncs-2026.1',
      total: 5,
      rows: [row('b'), row('a')],
    })
    expect(p.payloadVersion).toBe(SUBMISSION_PAYLOAD_VERSION)
    expect(p.kind).toBe('NCS_WEEKLY_RETURN')
    expect(p.weekStart).toBe('2026-09-28')
    expect(p.total).toBe(5)
    expect(p.reviewCount).toBe(2)
  })

  it('sorts rows by studentId for a deterministic payload', () => {
    const p = buildWeeklyReturnPayload({
      weekStart: '2026-09-28',
      calculationVersion: 'ncs-2026.1',
      total: 2,
      rows: [row('zed'), row('amy'), row('mae')],
    })
    expect(p.rows.map((r) => r.studentId)).toEqual(['amy', 'mae', 'zed'])
  })

  it('does not mutate the caller’s rows array', () => {
    const rows = [row('b'), row('a')]
    buildWeeklyReturnPayload({ weekStart: '2026-09-28', calculationVersion: null, total: 2, rows })
    expect(rows.map((r) => r.studentId)).toEqual(['b', 'a'])
  })
})
