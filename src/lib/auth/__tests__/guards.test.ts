import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  requireAuthForMfa,
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
      await expect(requireParent()).rejects.toThrow('REDIRECT:/admin/dashboard?notice=parent_page')
    },
  )

  it('redirects a teacher to the teacher dashboard', async () => {
    const user = makeUser({ roles: ['teacher'] })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireParent()).rejects.toThrow('REDIRECT:/teacher/dashboard?notice=parent_page')
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

// ─── Two-step sign-in (admins) ────────────────────────────────────────────────

describe('admin two-step sign-in enforcement', () => {
  // Far past the grace period for an admin since 2026-01-01 (rule live 2026-11-22).
  const longAgo = '2026-01-01T00:00:00Z'
  const admin = (mfa: NonNullable<SessionUser['mfa']>) =>
    makeUser({ roles: ['school_admin'], permissions: ['fees.view'], mfa })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('set up but code not entered this session → every privileged guard asks for the code', async () => {
    mockedGetSessionUser.mockResolvedValue(
      admin({ currentLevel: 'aal1', nextLevel: 'aal2', privilegedSince: longAgo }),
    )
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/mfa/verify')
    await expect(requirePermission('fees.view')).rejects.toThrow('REDIRECT:/mfa/verify')
    await expect(requireAuth()).rejects.toThrow('REDIRECT:/mfa/verify')
  })

  it('not set up and grace over → sent to set-up', async () => {
    mockedGetSessionUser.mockResolvedValue(
      admin({ currentLevel: 'aal1', nextLevel: 'aal1', privilegedSince: longAgo }),
    )
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/mfa/setup')
    await expect(requirePermission('fees.view')).rejects.toThrow('REDIRECT:/mfa/setup')
  })

  it('not set up but inside the grace period → allowed through', async () => {
    const user = admin({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
      privilegedSince: '2027-01-08T00:00:00Z', // became admin 2 days ago
    })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAdmin()).resolves.toEqual(user)
  })

  it('code entered this session → allowed through', async () => {
    const user = admin({ currentLevel: 'aal2', nextLevel: 'aal2', privilegedSince: longAgo })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAdmin()).resolves.toEqual(user)
  })

  it('parents and staff (no MFA state) are never affected', async () => {
    const parent = makeUser({ mfa: null })
    mockedGetSessionUser.mockResolvedValue(parent)
    await expect(requireAuth()).resolves.toEqual(parent)
    await expect(requireParent()).resolves.toEqual(parent)
  })

  it('the /mfa pages’ own guard never redirects to itself', async () => {
    const user = admin({ currentLevel: 'aal1', nextLevel: 'aal2', privilegedSince: longAgo })
    mockedGetSessionUser.mockResolvedValue(user)
    await expect(requireAuthForMfa()).resolves.toEqual(user)
  })
})
