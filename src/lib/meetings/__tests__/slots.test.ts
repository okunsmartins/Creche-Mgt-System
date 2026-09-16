import { describe, it, expect } from 'vitest'
import {
  generateMeetingSlots,
  filterNonOverlappingSlots,
  parseTimeToMinutes,
  isSlotInFuture,
  MAX_SLOTS_PER_BLOCK,
} from '../slots'
import { availabilityBlockSchema } from '../schemas'

describe('parseTimeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('14:30')).toBe(870)
    expect(parseTimeToMinutes('14:30:00')).toBe(870)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })

  it('rejects malformed or out-of-range times', () => {
    expect(parseTimeToMinutes('24:00')).toBeNull()
    expect(parseTimeToMinutes('12:60')).toBeNull()
    expect(parseTimeToMinutes('9:00')).toBeNull()
    expect(parseTimeToMinutes('noon')).toBeNull()
  })
})

describe('generateMeetingSlots', () => {
  it('splits a window into consecutive slots', () => {
    expect(generateMeetingSlots('14:00', '15:00', 15)).toEqual([
      { start: '14:00', end: '14:15' },
      { start: '14:15', end: '14:30' },
      { start: '14:30', end: '14:45' },
      { start: '14:45', end: '15:00' },
    ])
  })

  it('drops a trailing remainder shorter than the duration', () => {
    expect(generateMeetingSlots('14:00', '14:50', 20)).toEqual([
      { start: '14:00', end: '14:20' },
      { start: '14:20', end: '14:40' },
    ])
  })

  it('rejects invalid inputs', () => {
    expect(generateMeetingSlots('15:00', '14:00', 15)).toBeNull() // start >= end
    expect(generateMeetingSlots('14:00', '14:00', 15)).toBeNull()
    expect(generateMeetingSlots('14:00', '15:00', 7)).toBeNull() // unknown duration
    expect(generateMeetingSlots('14:xx', '15:00', 15)).toBeNull()
  })

  it('rejects a window shorter than one slot', () => {
    expect(generateMeetingSlots('14:00', '14:10', 15)).toBeNull()
  })

  it('caps the number of slots per block', () => {
    // 10-minute slots over 24h would be 144 > MAX_SLOTS_PER_BLOCK
    expect(generateMeetingSlots('00:00', '23:59', 10)).toBeNull()
    // At the cap is fine: 40 × 10min = 400min
    const ok = generateMeetingSlots('08:00', '14:40', 10)
    expect(ok).not.toBeNull()
    expect(ok!.length).toBe(MAX_SLOTS_PER_BLOCK)
  })
})

describe('filterNonOverlappingSlots', () => {
  const gen = generateMeetingSlots('14:00', '15:00', 20)! // 14:00–14:20, 14:20–14:40, 14:40–15:00

  it('keeps everything when there are no existing slots', () => {
    expect(filterNonOverlappingSlots(gen, [])).toEqual(gen)
  })

  it('drops slots overlapping existing ones (different durations, DB HH:MM:SS)', () => {
    // Existing 15-min slots 14:15–14:30 and 14:30–14:45 overlap the first two
    // 20-min slots but not 14:40–15:00... 14:30–14:45 overlaps 14:40–15:00 too.
    const existing = [
      { start_time: '14:15:00', end_time: '14:30:00' },
      { start_time: '14:30:00', end_time: '14:45:00' },
    ]
    expect(filterNonOverlappingSlots(gen, existing)).toEqual([])
  })

  it('back-to-back slots do not count as overlapping', () => {
    const existing = [{ start_time: '13:30:00', end_time: '14:00:00' }]
    expect(filterNonOverlappingSlots(gen, existing)).toEqual(gen)
  })

  it('drops only the colliding slot, keeps the rest', () => {
    const existing = [{ start_time: '14:20:00', end_time: '14:40:00' }]
    expect(filterNonOverlappingSlots(gen, existing)).toEqual([
      { start: '14:00', end: '14:20' },
      { start: '14:40', end: '15:00' },
    ])
  })
})

describe('isSlotInFuture', () => {
  it('future date is always in the future', () => {
    expect(isSlotInFuture('2026-09-02', '09:00', '2026-09-01', '23:00')).toBe(true)
  })
  it('past date is never in the future', () => {
    expect(isSlotInFuture('2026-08-31', '09:00', '2026-09-01', '00:01')).toBe(false)
  })
  it('same day compares times', () => {
    expect(isSlotInFuture('2026-09-01', '14:30', '2026-09-01', '14:00')).toBe(true)
    expect(isSlotInFuture('2026-09-01', '14:30:00', '2026-09-01', '14:30')).toBe(false)
    expect(isSlotInFuture('2026-09-01', '13:00', '2026-09-01', '14:00')).toBe(false)
  })
})

describe('availabilityBlockSchema', () => {
  it('accepts a valid block and coerces the duration', () => {
    const result = availabilityBlockSchema.safeParse({
      slotDate: '2026-09-01',
      startTime: '14:00',
      endTime: '16:00',
      durationMins: '15',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.durationMins).toBe(15)
  })

  it('rejects end before start', () => {
    const result = availabilityBlockSchema.safeParse({
      slotDate: '2026-09-01',
      startTime: '16:00',
      endTime: '14:00',
      durationMins: '15',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown duration', () => {
    const result = availabilityBlockSchema.safeParse({
      slotDate: '2026-09-01',
      startTime: '14:00',
      endTime: '16:00',
      durationMins: '25',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed date', () => {
    const result = availabilityBlockSchema.safeParse({
      slotDate: '01/09/2026',
      startTime: '14:00',
      endTime: '16:00',
      durationMins: '15',
    })
    expect(result.success).toBe(false)
  })

  it('treats an empty classId as undefined (all classes) and accepts a uuid', () => {
    const base = {
      slotDate: '2026-09-01',
      startTime: '14:00',
      endTime: '16:00',
      durationMins: '15',
    }
    const all = availabilityBlockSchema.safeParse({ ...base, classId: '' })
    expect(all.success).toBe(true)
    if (all.success) expect(all.data.classId).toBeUndefined()

    const one = availabilityBlockSchema.safeParse({
      ...base,
      classId: '11111111-1111-1111-1111-111111111111',
    })
    expect(one.success).toBe(true)
    if (one.success) expect(one.data.classId).toBe('11111111-1111-1111-1111-111111111111')

    const bad = availabilityBlockSchema.safeParse({ ...base, classId: 'not-a-uuid' })
    expect(bad.success).toBe(false)
  })
})
