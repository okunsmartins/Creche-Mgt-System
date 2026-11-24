import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { privilegedHomeFor } from '../landing'

describe('privilegedHomeFor', () => {
  const prev = process.env['PLATFORM_OWNER_EMAIL']
  beforeEach(() => {
    process.env['PLATFORM_OWNER_EMAIL'] = 'owner@example.com'
  })
  afterEach(() => {
    if (prev === undefined) delete process.env['PLATFORM_OWNER_EMAIL']
    else process.env['PLATFORM_OWNER_EMAIL'] = prev
  })

  it('the owner lands on Platform, with or without a crèche admin role', () => {
    expect(privilegedHomeFor({ email: 'owner@example.com', roles: ['school_admin'] })).toBe(
      '/platform',
    )
    expect(privilegedHomeFor({ email: 'owner@example.com', roles: [] })).toBe('/platform')
  })

  it('crèche admins land on the admin dashboard', () => {
    for (const role of ['super_admin', 'school_admin', 'finance_admin'])
      expect(privilegedHomeFor({ email: 'a@example.com', roles: [role] })).toBe('/admin/dashboard')
  })

  it('anyone else goes home', () => {
    expect(privilegedHomeFor({ email: 'p@example.com', roles: ['teacher'] })).toBe('/')
  })
})
