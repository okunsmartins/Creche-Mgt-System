import { describe, it, expect } from 'vitest'
import { countSegments } from '../segments'

describe('countSegments', () => {
  it('counts a short GSM-7 message as one segment', () => {
    expect(countSegments('Hello parents')).toEqual({ encoding: 'GSM-7', units: 13, segments: 1 })
  })

  it('splits GSM-7 at 160 chars', () => {
    expect(countSegments('a'.repeat(160)).segments).toBe(1)
    expect(countSegments('a'.repeat(161)).segments).toBe(2)
  })

  it('counts GSM extended chars (€) as two septets', () => {
    expect(countSegments('a'.repeat(158) + '€')).toMatchObject({ units: 160, segments: 1 })
    expect(countSegments('a'.repeat(159) + '€')).toMatchObject({ units: 161, segments: 2 })
  })

  it('switches to UCS-2 for a non-GSM char (smart quote)', () => {
    const r = countSegments('It’s time') // ’ = U+2019, not GSM
    expect(r.encoding).toBe('UCS-2')
    expect(r.segments).toBe(1)
  })

  it('splits UCS-2 at 70 units', () => {
    expect(countSegments('’'.repeat(70)).segments).toBe(1)
    expect(countSegments('’'.repeat(71)).segments).toBe(2)
  })

  it('treats an emoji as UCS-2 (surrogate pair = 2 units)', () => {
    expect(countSegments('😀')).toEqual({ encoding: 'UCS-2', units: 2, segments: 1 })
  })
})
