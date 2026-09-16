import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation before importing guards
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Mock session module
vi.mock('../session', () => ({
  getSessionUser: vi.fn(),
}))

import {
  requireAuth,
  requireVerifiedAuth,
  requireAdmin,
  requireParent,
  requirePermission,
} from '../guards'
import { getSessionUser } from '../session'
import type { SessionUser } from '@/types'

const mockedGetSessionUser = vi.mocked(getSessionUser)

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: true,
    profile: { firstName: 'Test', lastName: 'User' },
    roles: [],
    permissions: [],
    schoolId: 'school-1',
    schoolName: 'Test School',
    mustChangePassword: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns the user when authenticated', async () => {
    const user = makeUser()
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAuth()).resolves.toEqual(user)
  })

  it('redirects to /login when no session', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireAuth()).rejects.toThrow('REDIRECT:/login?reason=auth_required')
  })

  it('carries an app-relative `next` so the destination survives sign-in', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireAuth('/onboarding')).rejects.toThrow(
      'REDIRECT:/login?reason=auth_required&next=%2Fonboarding',
    )
  })

  it('ignores a non-relative `next` (no off-site redirect after login)', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireAuth('https://evil.example/steal')).rejects.toThrow(
      'REDIRECT:/login?reason=auth_required',
    )
  })
})

// ─── requireVerifiedAuth ──────────────────────────────────────────────────────

describe('requireVerifiedAuth', () => {
  it('returns the user when email is verified', async () => {
    const user = makeUser({ emailVerified: true })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireVerifiedAuth()).resolves.toEqual(user)
  })

  it('redirects to /verify-email when email not verified', async () => {
    const user = makeUser({ emailVerified: false })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireVerifiedAuth()).rejects.toThrow('REDIRECT:/verify-email')
  })

  it('redirects to /login when no session', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireVerifiedAuth()).rejects.toThrow('REDIRECT:/login?reason=auth_required')
  })
})

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it.each([['super_admin'], ['school_admin'], ['finance_admin']])(
    'allows user with role %s',
    async (role) => {
      const user = makeUser({ roles: [role] })
      mockedGetSessionUser.mockResolvedValue(user)
      await expect(requireAdmin()).resolves.toEqual(user)
    },
  )

  it('rejects a user with only the parent role', async () => {
    const user = makeUser({ roles: ['parent'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/parent/dashboard')
  })

  it('rejects a user with no roles', async () => {
    const user = makeUser({ roles: [] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/parent/dashboard')
  })

  it('redirects to /login when no session', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/login?reason=auth_required')
  })
})

// ─── requireParent ──────────────────────────────────────────────────────────

describe('requireParent', () => {
  it('allows a user with no staff roles (a parent)', async () => {
    const user = makeUser({ roles: [] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireParent()).resolves.toEqual(user)
  })

  it('allows a user with an explicit parent role', async () => {
    const user = makeUser({ roles: ['parent'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireParent()).resolves.toEqual(user)
  })

  it.each([['super_admin'], ['school_admin'], ['finance_admin']])(
    'redirects an admin (%s) to the admin dashboard',
    async (role) => {
      const user = makeUser({ roles: [role] })
      mockedGetSessionUser.mockResolvedValue(user)
      await expect(requireParent()).rejects.toThrow('REDIRECT:/admin/dashboard')
    },
  )

  it('redirects a teacher to the teacher dashboard', async () => {
    const user = makeUser({ roles: ['teacher'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireParent()).rejects.toThrow('REDIRECT:/teacher/dashboard')
  })

  it('redirects to /verify-email when email not verified', async () => {
    const user = makeUser({ emailVerified: false, roles: [] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireParent()).rejects.toThrow('REDIRECT:/verify-email')
  })

  it('redirects to /login when no session', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requireParent()).rejects.toThrow('REDIRECT:/login?reason=auth_required')
  })
})

// ─── requirePermission ────────────────────────────────────────────────────────

describe('requirePermission', () => {
  it('allows user who holds the required permission', async () => {
    const user = makeUser({ permissions: ['activities.read', 'payments.write'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requirePermission('activities.read')).resolves.toEqual(user)
  })

  it('rejects user missing the required permission', async () => {
    const user = makeUser({ permissions: ['activities.read'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requirePermission('payments.write')).rejects.toThrow('REDIRECT:/parent/dashboard')
  })

  it('rejects user with empty permissions', async () => {
    const user = makeUser({ permissions: [] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requirePermission('any.permission')).rejects.toThrow('REDIRECT:/parent/dashboard')
  })

  it('redirects to /login when no session', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    await expect(requirePermission('activities.read')).rejects.toThrow(
      'REDIRECT:/login?reason=auth_required',
    )
  })
})
