import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  vettingStatus,
  needsAttention,
  vettingStatusTone,
  VETTING_WARN_DAYS,
} from '../vetting'

describe('daysBetween', () => {
  it('counts whole days, tz-safe', () => {
    expect(daysBetween('2026-10-05', '2026-10-11')).toBe(6)
    expect(daysBetween('2026-10-11', '2026-10-05')).toBe(-6)
    expect(daysBetween('2026-10-05', '2026-10-05')).toBe(0)
  })
  it('is NaN for a bad date', () => {
    expect(Number.isNaN(daysBetween('nope', '2026-10-05'))).toBe(true)
  })
})

describe('vettingStatus', () => {
  const today = '2026-10-07'
  it('no expiry date → no-expiry', () => {
    expect(vettingStatus(null, today)).toBe('no-expiry')
    expect(vettingStatus(undefined, today)).toBe('no-expiry')
  })
  it('past expiry → expired', () => {
    expect(vettingStatus('2026-10-06', today)).toBe('expired')
  })
  it('within the warn window → expiring', () => {
    expect(vettingStatus(today, today)).toBe('expiring') // 0 days left
    expect(vettingStatus('2026-12-01', today)).toBe('expiring') // 55 days
  })
  it('boundary: exactly warnWithinDays away → expiring, one more → valid', () => {
    const warnEdge = '2026-12-06' // 60 days from 2026-10-07
    expect(daysBetween(today, warnEdge)).toBe(VETTING_WARN_DAYS)
    expect(vettingStatus(warnEdge, today)).toBe('expiring')
    expect(vettingStatus('2026-12-07', today)).toBe('valid') // 61 days
  })
  it('respects a custom warn window', () => {
    expect(vettingStatus('2026-10-20', today, 7)).toBe('valid') // 13 days > 7
    expect(vettingStatus('2026-10-12', today, 7)).toBe('expiring') // 5 days <= 7
  })
})

describe('needsAttention', () => {
  it('flags missing, expired, expiring only', () => {
    expect(needsAttention('missing')).toBe(true)
    expect(needsAttention('expired')).toBe(true)
    expect(needsAttention('expiring')).toBe(true)
    expect(needsAttention('valid')).toBe(false)
    expect(needsAttention('no-expiry')).toBe(false)
  })
})

describe('vettingStatusTone', () => {
  it('maps status to a badge tone', () => {
    expect(vettingStatusTone('valid')).toBe('success')
    expect(vettingStatusTone('expiring')).toBe('warning')
    expect(vettingStatusTone('expired')).toBe('error')
    expect(vettingStatusTone('missing')).toBe('default')
    expect(vettingStatusTone('no-expiry')).toBe('default')
  })
})
