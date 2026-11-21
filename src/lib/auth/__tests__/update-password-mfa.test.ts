// updatePasswordAction when two-step sign-in is set up: Supabase refuses a password
// change from a password-only (aal1) session with `insufficient_aal`. The admin must be
// sent to enter their code and then brought back to finish the reset.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
const updateUser = vi.fn()
const signOut = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { updateUser, signOut } }),
  createSupabaseAdminClient: vi.fn(),
}))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/env', () => ({ serverEnv: { appUrl: 'https://app.test' } }))
vi.mock('@/lib/tenant/server', () => ({
  getTenantSubdomain: vi.fn(),
  getTenantSchoolId: vi.fn(),
}))

import { updatePasswordAction } from '../actions'

function form() {
  const fd = new FormData()
  fd.set('password', 'NewPassw0rd!')
  fd.set('confirmPassword', 'NewPassw0rd!')
  return fd
}

describe('updatePasswordAction with two-step sign-in', () => {
  beforeEach(() => {
    updateUser.mockReset()
    signOut.mockReset()
  })

  it('asks for the code and comes back to /reset-password when Supabase wants aal2', async () => {
    updateUser.mockResolvedValue({ error: { code: 'insufficient_aal', name: 'AuthApiError' } })
    await expect(updatePasswordAction(null, form())).rejects.toThrow(
      'REDIRECT:/mfa/verify?next=/reset-password',
    )
    expect(signOut).not.toHaveBeenCalled()
  })

  it('other errors still show their message', async () => {
    updateUser.mockResolvedValue({ error: { code: 'same_password', name: 'AuthApiError' } })
    await expect(updatePasswordAction(null, form())).resolves.toEqual({
      error: 'Your new password must be different from your current password.',
    })
  })

  it('success signs out everywhere and goes to login', async () => {
    updateUser.mockResolvedValue({ error: null })
    await expect(updatePasswordAction(null, form())).rejects.toThrow(
      'REDIRECT:/login?reason=password_changed',
    )
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
  })
})
