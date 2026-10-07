import { describe, it, expect } from 'vitest'
import { coverShortfall, needsCover } from '../cover'

describe('coverShortfall', () => {
  it('is the staff short of requirement, floored at 0', () => {
    expect(coverShortfall(3, 1)).toBe(2)
    expect(coverShortfall(2, 2)).toBe(0)
    expect(coverShortfall(2, 5)).toBe(0)
  })
})

describe('needsCover', () => {
  it('true only when there is a requirement and too few rostered', () => {
    expect(needsCover(3, 2)).toBe(true)
    expect(needsCover(3, 3)).toBe(false)
    expect(needsCover(0, 0)).toBe(false) // no children → no requirement
    expect(needsCover(2, 0)).toBe(true) // children but nobody rostered
  })
})
