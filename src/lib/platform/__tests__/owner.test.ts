import { describe, it, expect } from 'vitest'
import { parseOwnerEmails, isOwnerEmail, isPlatformOwner } from '../owner'

describe('parseOwnerEmails', () => {
  it('splits, trims, lowercases and drops blanks', () => {
    expect(parseOwnerEmails('  Owner@Example.com , second@x.ie ,')).toEqual([
      'owner@example.com',
      'second@x.ie',
    ])
  })

  it('returns [] for empty / undefined', () => {
    expect(parseOwnerEmails('')).toEqual([])
    expect(parseOwnerEmails(undefined)).toEqual([])
    expect(parseOwnerEmails(null)).toEqual([])
  })
})

describe('isOwnerEmail', () => {
  const owners = ['owner@example.com', 'second@x.ie']

  it('matches case-insensitively', () => {
    expect(isOwnerEmail('Owner@Example.com', owners)).toBe(true)
    expect(isOwnerEmail('second@x.ie', owners)).toBe(true)
  })

  it('rejects non-owners and blanks', () => {
    expect(isOwnerEmail('someone@else.com', owners)).toBe(false)
    expect(isOwnerEmail(null, owners)).toBe(false)
    expect(isOwnerEmail('owner@example.com', [])).toBe(false)
  })
})

describe('isPlatformOwner (env-driven)', () => {
  it('reads PLATFORM_OWNER_EMAIL from the environment', () => {
    const prev = process.env['PLATFORM_OWNER_EMAIL']
    try {
      process.env['PLATFORM_OWNER_EMAIL'] = 'owner@example.com'
      expect(isPlatformOwner({ email: 'owner@example.com' })).toBe(true)
      expect(isPlatformOwner({ email: 'nope@example.com' })).toBe(false)
      expect(isPlatformOwner(null)).toBe(false)

      delete process.env['PLATFORM_OWNER_EMAIL']
      expect(isPlatformOwner({ email: 'owner@example.com' })).toBe(false)
    } finally {
      if (prev === undefined) delete process.env['PLATFORM_OWNER_EMAIL']
      else process.env['PLATFORM_OWNER_EMAIL'] = prev
    }
  })
})
