import { describe, it, expect } from 'vitest'
import {
  isEnquiryStatus,
  validateEnquiry,
  ENQUIRY_STATUSES,
  OPEN_ENQUIRY_STATUSES,
} from '../enquiries'

describe('enquiry statuses', () => {
  it('has the six pipeline stages', () => {
    expect(ENQUIRY_STATUSES).toEqual([
      'new',
      'contacted',
      'waitlisted',
      'offered',
      'enrolled',
      'declined',
    ])
    expect(isEnquiryStatus('offered')).toBe(true)
    expect(isEnquiryStatus('nope')).toBe(false)
  })
  it('open statuses exclude enrolled/declined', () => {
    expect(OPEN_ENQUIRY_STATUSES).not.toContain('enrolled')
    expect(OPEN_ENQUIRY_STATUSES).not.toContain('declined')
    expect(OPEN_ENQUIRY_STATUSES).toContain('waitlisted')
  })
})

describe('validateEnquiry', () => {
  it('requires a parent name', () => {
    expect(validateEnquiry({ parentName: '   ' }).ok).toBe(false)
    expect(validateEnquiry({ parentName: 'Jane Doe' }).ok).toBe(true)
  })
  it('validates email when provided', () => {
    expect(validateEnquiry({ parentName: 'Jane', parentEmail: 'not-an-email' }).ok).toBe(false)
    expect(validateEnquiry({ parentName: 'Jane', parentEmail: 'jane@example.com' }).ok).toBe(true)
    expect(validateEnquiry({ parentName: 'Jane', parentEmail: '' }).ok).toBe(true) // optional
  })
})
