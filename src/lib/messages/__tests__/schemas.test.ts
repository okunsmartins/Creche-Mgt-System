import { describe, it, expect } from 'vitest'
import { parentMessageSchema } from '../schemas'

const classId = '11111111-1111-1111-1111-111111111111'

describe('parentMessageSchema', () => {
  it('accepts a valid class message and trims subject/body', () => {
    const result = parentMessageSchema.safeParse({
      subject: '  School closure  ',
      body: '  Closed Friday.  ',
      audience: { type: 'class', classId },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subject).toBe('School closure')
      expect(result.data.body).toBe('Closed Friday.')
      expect(result.data.audience).toEqual({ type: 'class', classId })
    }
  })

  it('accepts a school audience with no id', () => {
    const result = parentMessageSchema.safeParse({
      subject: 'Notice',
      body: 'Hello',
      audience: { type: 'school' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty subject', () => {
    const result = parentMessageSchema.safeParse({
      subject: '',
      body: 'Hello',
      audience: { type: 'school' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty body', () => {
    const result = parentMessageSchema.safeParse({
      subject: 'Hi',
      body: '   ',
      audience: { type: 'school' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a class audience with a non-uuid classId', () => {
    const result = parentMessageSchema.safeParse({
      subject: 'Hi',
      body: 'Hello',
      audience: { type: 'class', classId: 'not-a-uuid' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an over-long subject (>150)', () => {
    const result = parentMessageSchema.safeParse({
      subject: 'x'.repeat(151),
      body: 'Hello',
      audience: { type: 'school' },
    })
    expect(result.success).toBe(false)
  })
})
