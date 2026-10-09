import { describe, it, expect } from 'vitest'
import { paymentLinkSchema } from '../schemas'

const VALID_UUID = '30000000-0000-0000-0000-000000000001'
const FUTURE_DATE = new Date(Date.now() + 86_400_000).toISOString()

describe('paymentLinkSchema', () => {
  const valid = {
    targetType: 'activity',
    targetId: VALID_UUID,
    label: 'Dublin Zoo – Class 1A',
    expiresAt: FUTURE_DATE,
    maxUses: '50',
    isActive: 'true',
  }

  it('accepts a fully populated activity payment link', () => {
    const result = paymentLinkSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.targetType).toBe('activity')
      expect(result.data.targetId).toBe(VALID_UUID)
      expect(result.data.label).toBe('Dublin Zoo – Class 1A')
      expect(result.data.maxUses).toBe(50)
      expect(result.data.isActive).toBe(true)
    }
  })

  it('accepts a programme payment link', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, targetType: 'programme' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.targetType).toBe('programme')
  })

  it('rejects an invalid target type', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, targetType: 'teacher' })
    expect(result.success).toBe(false)
  })

  it('accepts a link with no expiry or max uses', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, expiresAt: '', maxUses: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.expiresAt).toBeUndefined()
      expect(result.data.maxUses).toBeUndefined()
    }
  })

  it('rejects a non-UUID targetId', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, targetId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty label', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, label: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a label longer than 200 characters', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, label: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects a past expiry date', () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString()
    const result = paymentLinkSchema.safeParse({ ...valid, expiresAt: pastDate })
    expect(result.success).toBe(false)
  })

  it('rejects maxUses of zero', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, maxUses: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects a negative maxUses value', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, maxUses: '-5' })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from label', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, label: '  Dublin Zoo  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.label).toBe('Dublin Zoo')
  })

  it('sets isActive to false when the field value is "false"', () => {
    const result = paymentLinkSchema.safeParse({ ...valid, isActive: 'false' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.isActive).toBe(false)
  })
})
