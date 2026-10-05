import { describe, it, expect } from 'vitest'
import {
  CHANGE_CLASSIFICATIONS,
  diffCoreProfiles,
  hasDrift,
  summariseDrift,
  type CoreProfile,
} from '../core-funding'

const base: CoreProfile = { staffCount: 5, roomCount: 4, totalCapacity: 60, operatingWeeks: 52 }

describe('diffCoreProfiles', () => {
  it('no changes when the profiles match', () => {
    const changes = diffCoreProfiles(base, { ...base })
    expect(changes).toEqual([])
    expect(hasDrift(changes)).toBe(false)
  })

  it('detects a staff departure and a capacity reduction', () => {
    const changes = diffCoreProfiles(base, { ...base, staffCount: 4, totalCapacity: 54 })
    expect(hasDrift(changes)).toBe(true)
    expect(changes).toContainEqual({
      field: 'staffCount',
      label: 'Staff',
      from: 5,
      to: 4,
      delta: -1,
    })
    expect(changes).toContainEqual({
      field: 'totalCapacity',
      label: 'Total capacity (places)',
      from: 60,
      to: 54,
      delta: -6,
    })
  })

  it('detects operating-weeks and room changes with correct deltas', () => {
    const changes = diffCoreProfiles(base, { ...base, operatingWeeks: 50, roomCount: 5 })
    const byField = Object.fromEntries(changes.map((c) => [c.field, c.delta]))
    expect(byField.operatingWeeks).toBe(-2)
    expect(byField.roomCount).toBe(1)
  })
})

describe('summariseDrift', () => {
  it('renders a plain-language summary', () => {
    const changes = diffCoreProfiles(base, { ...base, staffCount: 4, totalCapacity: 54 })
    expect(summariseDrift(changes)).toBe('Staff 5 → 4; Total capacity (places) 60 → 54')
  })
})

describe('change classifications', () => {
  it('has the four manager classifications', () => {
    expect(CHANGE_CLASSIFICATIONS).toEqual([
      'NO_IMPACT',
      'REVIEW_REQUIRED',
      'APPLICATION_CHANGE_REQUIRED',
      'EXTERNALLY_COMPLETED',
    ])
  })
})
