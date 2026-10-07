import { describe, it, expect } from 'vitest'
import {
  CERTIFICATION_KINDS,
  isCertificationKind,
  certificationStatus,
  certificationStatusLabel,
  certificationStatusTone,
  certificationNeedsAttention,
} from '../certifications'

describe('certification kinds', () => {
  it('are qualification/training/other', () => {
    expect(CERTIFICATION_KINDS).toEqual(['qualification', 'training', 'other'])
    expect(isCertificationKind('training')).toBe(true)
    expect(isCertificationKind('nope')).toBe(false)
  })
})

describe('certificationStatus', () => {
  const today = '2026-10-07'
  it('no date → no-expiry', () => {
    expect(certificationStatus(null, today)).toBe('no-expiry')
  })
  it('past → expired, within 60d → expiring, beyond → valid', () => {
    expect(certificationStatus('2026-10-01', today)).toBe('expired')
    expect(certificationStatus('2026-11-01', today)).toBe('expiring') // 25 days
    expect(certificationStatus('2027-06-01', today)).toBe('valid')
  })
  it('honours a custom warn window', () => {
    expect(certificationStatus('2026-10-20', today, 7)).toBe('valid') // 13 > 7
    expect(certificationStatus('2026-10-12', today, 7)).toBe('expiring') // 5 <= 7
  })
})

describe('labels / tone / attention', () => {
  it('labels each status', () => {
    expect(certificationStatusLabel('valid')).toBe('Valid')
    expect(certificationStatusLabel('expiring')).toBe('Expiring')
    expect(certificationStatusLabel('expired')).toBe('Expired')
    expect(certificationStatusLabel('no-expiry')).toBe('No expiry date')
  })
  it('maps tone', () => {
    expect(certificationStatusTone('expired')).toBe('error')
    expect(certificationStatusTone('expiring')).toBe('warning')
    expect(certificationStatusTone('valid')).toBe('success')
    expect(certificationStatusTone('no-expiry')).toBe('default')
  })
  it('flags expired/expiring only', () => {
    expect(certificationNeedsAttention('expired')).toBe(true)
    expect(certificationNeedsAttention('expiring')).toBe(true)
    expect(certificationNeedsAttention('valid')).toBe(false)
    expect(certificationNeedsAttention('no-expiry')).toBe(false)
  })
})
