// Where signInAction sends people when there's no ?next=. The platform owner lands on
// /platform (which links on to their own crèche dashboard); other admins land on the
// admin dashboard, teachers on theirs, everyone else on the parent dashboard.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

let authEmail = 'admin@example.com'
let roleNames: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: authEmail } } })),
    },
  }),
  createSupabaseAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({
          data: table === 'user_roles' ? roleNames.map((_, i) => ({ role_id: `r${i}` })) : [],
        }),
        in: async () => ({ data: roleNames.map((name) => ({ name })) }),
      }),
    }),
  }),
}))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/env', () => ({ serverEnv: { appUrl: 'https://app.test' } }))
vi.mock('@/lib/tenant/server', () => ({
  getTenantSubdomain: vi.fn(),
  getTenantSchoolId: vi.fn(),
}))

import { signInAction } from '../actions'

function form(next?: string) {
  const fd = new FormData()
  fd.set('email', authEmail)
  fd.set('password', 'Passw0rd!')
  if (next) fd.set('next', next)
  return fd
}

describe('signInAction landing page', () => {
  const prevOwner = process.env['PLATFORM_OWNER_EMAIL']
  beforeEach(() => {
    process.env['PLATFORM_OWNER_EMAIL'] = 'owner@example.com'
    authEmail = 'admin@example.com'
    roleNames = []
  })
  afterEach(() => {
    if (prevOwner === undefined) delete process.env['PLATFORM_OWNER_EMAIL']
    else process.env['PLATFORM_OWNER_EMAIL'] = prevOwner
  })

  it('the owner who is also a crèche admin lands on Platform', async () => {
    authEmail = 'owner@example.com'
    roleNames = ['school_admin']
    await expect(signInAction(null, form())).rejects.toThrow('REDIRECT:/platform')
  })

  it('a crèche admin lands on the admin dashboard', async () => {
    roleNames = ['school_admin']
    await expect(signInAction(null, form())).rejects.toThrow('REDIRECT:/admin/dashboard')
  })

  it('a teacher lands on the teacher dashboard', async () => {
    roleNames = ['teacher']
    await expect(signInAction(null, form())).rejects.toThrow('REDIRECT:/teacher/dashboard')
  })

  it('a parent lands on the parent dashboard', async () => {
    await expect(signInAction(null, form())).rejects.toThrow('REDIRECT:/parent/dashboard')
  })

  it('an explicit ?next= still wins, even for the owner', async () => {
    authEmail = 'owner@example.com'
    await expect(signInAction(null, form('/admin/fees'))).rejects.toThrow('REDIRECT:/admin/fees')
  })
})
