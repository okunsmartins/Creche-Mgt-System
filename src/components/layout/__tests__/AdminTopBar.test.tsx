import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminTopBar } from '../AdminTopBar'
import type { SessionUser } from '@/types'

const user: SessionUser = {
  id: 'u1',
  email: 'admin@creche.test',
  emailVerified: true,
  profile: { firstName: 'Ann', lastName: 'Admin' },
  roles: ['school_admin'],
  permissions: [],
  schoolId: 's1',
  schoolName: 'Little Acorns',
  mustChangePassword: false,
}

describe('AdminTopBar: owner-only Platform button', () => {
  it('shows a Platform button linking to /platform for the platform owner', () => {
    render(<AdminTopBar user={user} isOwner />)
    const link = screen.getByRole('link', { name: /platform: owner overview/i })
    expect(link.getAttribute('href')).toBe('/platform')
  })

  it('never shows it to ordinary crèche admins', () => {
    render(<AdminTopBar user={user} />)
    expect(screen.queryByRole('link', { name: /platform: owner overview/i })).toBeNull()
  })
})
