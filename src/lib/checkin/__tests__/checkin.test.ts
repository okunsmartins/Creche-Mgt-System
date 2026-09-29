import { describe, it, expect } from 'vitest'
import { checkInState, isPresentNow, countPresent } from '../checkin'

describe('checkInState', () => {
  it('not_in when no arrival', () => {
    expect(checkInState(null)).toBe('not_in')
    expect(checkInState(undefined)).toBe('not_in')
    expect(checkInState({ checked_in_at: null, checked_out_at: null })).toBe('not_in')
  })
  it('in when arrived and not departed', () => {
    expect(checkInState({ checked_in_at: '2026-09-29T08:00:00Z', checked_out_at: null })).toBe('in')
  })
  it('out when departed', () => {
    expect(
      checkInState({
        checked_in_at: '2026-09-29T08:00:00Z',
        checked_out_at: '2026-09-29T16:00:00Z',
      }),
    ).toBe('out')
  })
})

describe('isPresentNow / countPresent', () => {
  it('only counts arrived-not-departed', () => {
    const rows = [
      { checked_in_at: '2026-09-29T08:00:00Z', checked_out_at: null }, // in
      { checked_in_at: '2026-09-29T08:30:00Z', checked_out_at: '2026-09-29T12:00:00Z' }, // out
      null, // not in
      { checked_in_at: '2026-09-29T09:00:00Z', checked_out_at: null }, // in
    ]
    expect(rows.map(isPresentNow)).toEqual([true, false, false, true])
    expect(countPresent(rows)).toBe(2)
  })
  it('empty list → 0', () => {
    expect(countPresent([])).toBe(0)
  })
})
