import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, minutesLate, computeLateFee, type LateFeePolicy } from '../fee'

const policy: LateFeePolicy = {
  cutoffTime: '18:00',
  graceMinutes: 5,
  flatFeeCents: 500, // €5 flat once late beyond grace
  perBlockFeeCents: 200, // €2 per block
  blockMinutes: 15,
}

describe('parseTimeToMinutes', () => {
  it('parses HH:MM', () => {
    expect(parseTimeToMinutes('18:00')).toBe(1080)
    expect(parseTimeToMinutes('09:30')).toBe(570)
    expect(parseTimeToMinutes('0:05')).toBe(5)
  })
  it('rejects malformed', () => {
    expect(Number.isNaN(parseTimeToMinutes('25:00'))).toBe(true)
    expect(Number.isNaN(parseTimeToMinutes('18:60'))).toBe(true)
    expect(Number.isNaN(parseTimeToMinutes('abc'))).toBe(true)
  })
})

describe('minutesLate', () => {
  it('positive when after cutoff, negative before, 0 on time', () => {
    expect(minutesLate('18:00', '18:20')).toBe(20)
    expect(minutesLate('18:00', '17:45')).toBe(-15)
    expect(minutesLate('18:00', '18:00')).toBe(0)
  })
  it('NaN on bad input', () => {
    expect(Number.isNaN(minutesLate('18:00', 'nope'))).toBe(true)
  })
})

describe('computeLateFee', () => {
  it('no charge when not late or within grace', () => {
    expect(computeLateFee(policy, 0)).toBe(0)
    expect(computeLateFee(policy, -10)).toBe(0)
    expect(computeLateFee(policy, 5)).toBe(0) // exactly at grace
    expect(computeLateFee(policy, 3)).toBe(0) // within grace
  })
  it('flat + per-block beyond grace, blocks rounded up', () => {
    // 20 late - 5 grace = 15 chargeable = 1 block → 500 + 200
    expect(computeLateFee(policy, 20)).toBe(700)
    // 6 late - 5 = 1 chargeable → ceil(1/15)=1 block → 500 + 200
    expect(computeLateFee(policy, 6)).toBe(700)
    // 35 late - 5 = 30 chargeable → 2 blocks → 500 + 400
    expect(computeLateFee(policy, 35)).toBe(900)
  })
  it('flat-only policy ignores blocks', () => {
    const flatOnly: LateFeePolicy = { ...policy, perBlockFeeCents: 0 }
    expect(computeLateFee(flatOnly, 40)).toBe(500)
  })
  it('per-block-only policy (no flat)', () => {
    const perBlockOnly: LateFeePolicy = { ...policy, flatFeeCents: 0, graceMinutes: 0 }
    expect(computeLateFee(perBlockOnly, 30)).toBe(400) // 2 blocks * 200
  })
})
