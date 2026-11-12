import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/auth/actions', () => ({ signOutAndContinueAction: vi.fn() }))

import { StaffOnParentPageNotice, PARENT_PAGE_NOTICE } from '../StaffOnParentPageNotice'

describe('StaffOnParentPageNotice', () => {
  it('explains the parent link and offers a sign-out that returns to the login page', () => {
    const { container } = render(<StaffOnParentPageNotice />)
    expect(screen.getByText('This link is for parents')).toBeInTheDocument()
    expect(screen.getByText(/signed in as crèche staff/)).toBeInTheDocument()
    expect(screen.getByText(/sign in with your\s+parent account/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(container.querySelector('input[name="next"]')).toHaveValue('/login')
  })

  it('matches the flag the parent guard adds to the redirect', () => {
    expect(PARENT_PAGE_NOTICE).toBe('parent_page')
  })
})
