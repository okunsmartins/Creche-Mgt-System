import { describe, it, expect } from 'vitest'
import { availablePlaces, daysUntil, isUpcomingLeaver } from '../places'

describe('availablePlaces', () => {
  it('capacity − enrolled, floored at 0; null when no capacity', () => {
    expect(availablePlaces(10, 7)).toBe(3)
    expect(availablePlaces(10, 12)).toBe(0)
    expect(availablePlaces(null, 5)).toBeNull()
    expect(availablePlaces(10, 0)).toBe(10)
  })
})

describe('daysUntil', () => {
  it('counts whole days', () => {
    expect(daysUntil('2026-10-08', '2026-10-18')).toBe(10)
    expect(daysUntil('2026-10-18', '2026-10-08')).toBe(-10)
  })
})

describe('isUpcomingLeaver', () => {
  const today = '2026-10-08'
  it('true within the horizon, from today onward', () => {
    expect(isUpcomingLeaver('2026-10-08', today)).toBe(true) // today
    expect(isUpcomingLeaver('2026-11-01', today)).toBe(true) // 24 days
    expect(isUpcomingLeaver('2026-10-07', today)).toBe(false) // already left
    expect(isUpcomingLeaver('2027-06-01', today)).toBe(false) // beyond 90d
    expect(isUpcomingLeaver(null, today)).toBe(false)
  })
  it('respects a custom horizon', () => {
    expect(isUpcomingLeaver('2026-10-20', today, 7)).toBe(false) // 12 > 7
    expect(isUpcomingLeaver('2026-10-13', today, 7)).toBe(true) // 5 <= 7
  })
})
