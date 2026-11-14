import { describe, it, expect } from 'vitest'
import {
  assessLeaveRequest,
  datesInRange,
  describeAssessment,
  hasWarnings,
  MAX_COVER_DAYS,
  type LeaveRequestLite,
  type RoomRequirement,
  type ShiftLite,
} from '../cover'

const req = (
  id: string,
  teacherId: string,
  name: string,
  start: string,
  end: string,
  status: LeaveRequestLite['status'] = 'pending',
): LeaveRequestLite => ({ id, teacherId, name, start, end, status })

const rooms: RoomRequirement[] = [
  { roomId: 'baby', roomName: 'Baby Room', requiredStaff: 2 },
  { roomId: 'pre', roomName: 'Preschool', requiredStaff: 1 },
]

describe('datesInRange', () => {
  it('lists inclusive dates across a month end', () => {
    expect(datesInRange('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ])
  })
  it('caps very long ranges', () => {
    expect(datesInRange('2026-01-01', '2027-12-31')).toHaveLength(MAX_COVER_DAYS)
  })
})

describe('assessLeaveRequest', () => {
  const target = req('t', 'amy', 'Amy', '2026-12-01', '2026-12-02')

  it('is clean when nobody else is off and cover holds', () => {
    const shifts: ShiftLite[] = [
      { teacherId: 'amy', roomId: 'pre', date: '2026-12-01' },
      { teacherId: 'ben', roomId: 'pre', date: '2026-12-01' },
    ]
    const a = assessLeaveRequest(target, [target], shifts, rooms)
    expect(hasWarnings(a)).toBe(false)
    expect(a.onRota).toBe(true)
  })

  it('separates approved and pending overlaps and ignores rejected / other dates / self', () => {
    const all = [
      target,
      req('a', 'ben', 'Ben', '2026-12-02', '2026-12-05', 'approved'),
      req('b', 'cat', 'Cat', '2026-11-30', '2026-12-01', 'pending'),
      req('c', 'dan', 'Dan', '2026-12-01', '2026-12-01', 'rejected'),
      req('d', 'eve', 'Eve', '2026-12-03', '2026-12-04', 'approved'),
      req('e', 'amy', 'Amy', '2026-12-01', '2026-12-01', 'approved'),
    ]
    const a = assessLeaveRequest(target, all, [], rooms)
    expect(a.approvedOverlap).toEqual(['Ben'])
    expect(a.pendingOverlap).toEqual(['Cat'])
    expect(a.onRota).toBe(false)
    expect(hasWarnings(a)).toBe(true)
  })

  it('flags a room that drops below its ratio when this person is removed', () => {
    const shifts: ShiftLite[] = [
      { teacherId: 'amy', roomId: 'baby', date: '2026-12-01' },
      { teacherId: 'ben', roomId: 'baby', date: '2026-12-01' },
      // Day 2: a third person keeps the Baby Room covered.
      { teacherId: 'amy', roomId: 'baby', date: '2026-12-02' },
      { teacherId: 'ben', roomId: 'baby', date: '2026-12-02' },
      { teacherId: 'cat', roomId: 'baby', date: '2026-12-02' },
    ]
    const a = assessLeaveRequest(target, [target], shifts, rooms)
    expect(a.shortfalls).toEqual([
      {
        date: '2026-12-01',
        roomId: 'baby',
        roomName: 'Baby Room',
        requiredStaff: 2,
        staffIfApproved: 1,
      },
    ])
  })

  it('does not count staff already approved off that day as cover', () => {
    const shifts: ShiftLite[] = [
      { teacherId: 'amy', roomId: 'baby', date: '2026-12-01' },
      { teacherId: 'ben', roomId: 'baby', date: '2026-12-01' },
      { teacherId: 'cat', roomId: 'baby', date: '2026-12-01' },
    ]
    const all = [target, req('x', 'cat', 'Cat', '2026-12-01', '2026-12-01', 'approved')]
    const a = assessLeaveRequest(target, all, shifts, rooms)
    expect(a.shortfalls).toHaveLength(1)
    expect(a.shortfalls[0]!.staffIfApproved).toBe(1)
  })

  it('ignores rooms this person is not rostered in (pre-existing gaps are not theirs)', () => {
    const shifts: ShiftLite[] = [
      { teacherId: 'amy', roomId: 'pre', date: '2026-12-01' },
      { teacherId: 'ben', roomId: 'pre', date: '2026-12-01' },
      { teacherId: 'cat', roomId: 'baby', date: '2026-12-01' }, // Baby Room already short
    ]
    const a = assessLeaveRequest(target, [target], shifts, rooms)
    expect(a.shortfalls).toEqual([])
  })

  it('ignores shifts outside the leave dates and rooms with no requirement', () => {
    const shifts: ShiftLite[] = [
      { teacherId: 'amy', roomId: 'baby', date: '2026-12-05' },
      { teacherId: 'amy', roomId: 'empty', date: '2026-12-01' },
    ]
    const a = assessLeaveRequest(target, [target], shifts, [
      ...rooms,
      { roomId: 'empty', roomName: 'Empty', requiredStaff: 0 },
    ])
    expect(a.shortfalls).toEqual([])
    expect(a.onRota).toBe(true)
  })
})

describe('describeAssessment', () => {
  it('writes plain-English lines and truncates long shortfall lists', () => {
    const shortfalls = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-12-0${i + 1}`,
      roomId: 'baby',
      roomName: 'Baby Room',
      requiredStaff: 2,
      staffIfApproved: 1,
    }))
    const lines = describeAssessment({
      approvedOverlap: ['Ben'],
      pendingOverlap: ['Cat'],
      shortfalls,
      onRota: true,
    })
    expect(lines[0]).toContain('Ben')
    expect(lines[1]).toContain('Cat')
    expect(lines[2]).toBe('2026-12-01: Baby Room would have 1 staff but needs 2 for its ratio.')
    expect(lines.at(-1)).toBe('…and 2 more room-days short.')
  })
})
