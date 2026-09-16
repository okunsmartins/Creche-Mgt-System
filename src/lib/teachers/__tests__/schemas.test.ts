import { describe, it, expect } from 'vitest'
import { teacherSchema } from '../schemas'

describe('teacherSchema', () => {
  const valid = {
    firstName: 'Máire',
    lastName: 'Ní Bhriain',
    email: 'mbriain@example.ie',
    isActive: 'true',
  }

  it('accepts a fully populated teacher', () => {
    const result = teacherSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe('Máire')
      expect(result.data.lastName).toBe('Ní Bhriain')
      expect(result.data.email).toBe('mbriain@example.ie')
      expect(result.data.isActive).toBe(true)
    }
  })

  it('accepts a teacher with no email', () => {
    const result = teacherSchema.safeParse({ ...valid, email: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeUndefined()
  })

  it('lowercases the email address', () => {
    const result = teacherSchema.safeParse({ ...valid, email: 'UPPER@EXAMPLE.IE' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('upper@example.ie')
  })

  it('trims whitespace from first and last name', () => {
    const result = teacherSchema.safeParse({
      ...valid,
      firstName: '  Máire  ',
      lastName: '  Ní Bhriain  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe('Máire')
      expect(result.data.lastName).toBe('Ní Bhriain')
    }
  })

  it('rejects an empty first name', () => {
    const result = teacherSchema.safeParse({ ...valid, firstName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty last name', () => {
    const result = teacherSchema.safeParse({ ...valid, lastName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed email address', () => {
    const result = teacherSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a first name longer than 100 characters', () => {
    const result = teacherSchema.safeParse({ ...valid, firstName: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('sets isActive to false when the field value is "false"', () => {
    const result = teacherSchema.safeParse({ ...valid, isActive: 'false' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.isActive).toBe(false)
  })
})
