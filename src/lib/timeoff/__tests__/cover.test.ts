import { describe, it, expect } from 'vitest'
import {
  assessLeaveRequest,
  datesInRange,
  describeAssessment,
  hasWarnings,
  hasCoverGaps,
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
      uncheckedAges: [],
      uncheckedDays: 0,
    })
    expect(lines[0]).toContain('Ben')
    expect(lines[1]).toContain('Cat')
    expect(lines[2]).toBe('2026-12-01: Baby Room would have 1 staff but needs 2 for its ratio.')
    expect(lines.at(-1)).toBe('…and 2 more room-days short.')
  })
})

describe('cover gaps (review 2026-11-15)', () => {
  const shift = (teacherId: string, roomId: string, date: string): ShiftLite => ({
    teacherId,
    roomId,
    date,
  })

  it('names rooms whose children have no date of birth, and does not claim full cover', () => {
    const a = assessLeaveRequest(
      req('r1', 't1', 'Ann', '2026-11-24', '2026-11-24'),
      [],
      [shift('t1', 'wob', '2026-11-24'), shift('t2', 'wob', '2026-11-24')],
      [{ roomId: 'wob', roomName: 'Wobblers', requiredStaff: 1, unknownAgeChildren: 2 }],
    )
    expect(a.shortfalls).toEqual([]) // t2 still covers the 1 required
    expect(a.uncheckedAges).toEqual([{ roomName: 'Wobblers', children: 2 }])
    expect(hasWarnings(a)).toBe(false)
    expect(hasCoverGaps(a)).toBe(true)
    expect(describeAssessment(a)).toContain(
      "Wobblers: 2 children have no date of birth, so their ratio couldn't be counted. Add it on the child's profile.",
    )
  })

  it('ignores unknown ages in rooms the person is not rostered in', () => {
    const a = assessLeaveRequest(
      req('r1', 't1', 'Ann', '2026-11-24', '2026-11-24'),
      [],
      [shift('t1', 'pre', '2026-11-24')],
      [
        { roomId: 'pre', roomName: 'Preschool', requiredStaff: 0 },
        { roomId: 'wob', roomName: 'Wobblers', requiredStaff: 1, unknownAgeChildren: 3 },
      ],
    )
    expect(a.uncheckedAges).toEqual([])
    expect(hasCoverGaps(a)).toBe(false)
  })

  it('says how many days of a very long request were not checked', () => {
    const a = assessLeaveRequest(req('r1', 't1', 'Ann', '2026-01-01', '2026-03-31'), [], [], rooms)
    expect(a.uncheckedDays).toBe(90 - MAX_COVER_DAYS)
    expect(hasCoverGaps(a)).toBe(true)
    expect(describeAssessment(a).at(-1)).toBe(
      `Only the first ${MAX_COVER_DAYS} days were checked; the last 28 days were not.`,
    )
  })

  it('a normal request has no gaps', () => {
    const a = assessLeaveRequest(req('r1', 't1', 'Ann', '2026-11-24', '2026-11-25'), [], [], rooms)
    expect(a.uncheckedDays).toBe(0)
    expect(a.uncheckedAges).toEqual([])
  })
})
