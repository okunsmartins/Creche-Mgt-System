import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas'

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined()
    }
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined()
    }
  })
})

// ─── registerSchema ───────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const valid = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
  }

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'password1',
      confirmPassword: 'password1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors
      expect(errs.password).toBeDefined()
    }
  })

  it('rejects password without a number', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'PasswordA',
      confirmPassword: 'PasswordA',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: 'Pass1',
      confirmPassword: 'Pass1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched confirmPassword', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined()
    }
  })

  it('rejects empty firstName', () => {
    const result = registerSchema.safeParse({ ...valid, firstName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects firstName longer than 50 characters', () => {
    const result = registerSchema.safeParse({ ...valid, firstName: 'A'.repeat(51) })
    expect(result.success).toBe(false)
  })
})

// ─── forgotPasswordSchema ─────────────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

// ─── resetPasswordSchema ──────────────────────────────────────────────────────

describe('resetPasswordSchema', () => {
  const valid = { password: 'NewPass1', confirmPassword: 'NewPass1' }

  it('accepts matching strong passwords', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects weak password', () => {
    const result = resetPasswordSchema.safeParse({ password: 'weak', confirmPassword: 'weak' })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'Other1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined()
    }
  })
})
