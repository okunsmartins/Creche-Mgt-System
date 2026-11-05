import { describe, it, expect } from 'vitest'
import { existingPortalFor } from '../existing-portal'

const base = { roles: [] as string[], schoolId: null as string | null, schoolName: null }

describe('existingPortalFor', () => {
  it('signed out, or signed in with no crèche → free to create one', () => {
    expect(existingPortalFor(null)).toBeNull()
    expect(existingPortalFor(base)).toBeNull()
  })

  it('crèche admins are pointed at their admin portal', () => {
    for (const role of ['school_admin', 'super_admin', 'finance_admin']) {
      expect(
        existingPortalFor({ roles: [role], schoolId: 's1', schoolName: 'Angels Nest' }),
      ).toEqual({ href: '/admin/dashboard', schoolName: 'Angels Nest', role: 'admin' })
    }
  })

  it('staff go to the teacher portal, parents to the parent portal', () => {
    expect(existingPortalFor({ roles: ['teacher'], schoolId: 's1', schoolName: 'A' })?.href).toBe(
      '/teacher/dashboard',
    )
    expect(existingPortalFor({ roles: ['parent'], schoolId: 's1', schoolName: 'A' })).toEqual({
      href: '/parent/dashboard',
      schoolName: 'A',
      role: 'parent',
    })
  })

  it('admin wins when someone has several roles', () => {
    expect(
      existingPortalFor({ roles: ['parent', 'school_admin'], schoolId: 's1', schoolName: 'A' })
        ?.role,
    ).toBe('admin')
  })
})
