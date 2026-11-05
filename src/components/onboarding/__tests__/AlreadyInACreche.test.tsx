import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/auth/actions', () => ({ signOutAndContinueAction: vi.fn() }))

import { AlreadyInACreche } from '../AlreadyInACreche'

describe('AlreadyInACreche', () => {
  const portal = { href: '/admin/dashboard', schoolName: 'Angels Nest', role: 'admin' as const }

  it('explains why, and offers sign-out-and-continue plus a way back', () => {
    const { container } = render(
      <AlreadyInACreche email="manager@example.com" portal={portal} continueTo="/onboarding" />,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: /signed in to Angels Nest/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/an administrator at Angels Nest/)).toBeInTheDocument()
    expect(screen.getByText('manager@example.com')).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Sign out and set up a new crèche' }),
    ).toBeInTheDocument()
    expect(container.querySelector('input[name="next"]')).toHaveValue('/onboarding')

    expect(screen.getByRole('link', { name: /Go to my Angels Nest portal/ })).toHaveAttribute(
      'href',
      '/admin/dashboard',
    )
  })

  it('embedded mode drops the card and uses a sub-heading', () => {
    const { container } = render(
      <AlreadyInACreche
        embedded
        email="p@example.com"
        portal={{ href: '/parent/dashboard', schoolName: null, role: 'parent' }}
        continueTo="/onboarding"
      />,
    )
    expect(container.querySelector('.card')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('signed in to a crèche')
    expect(screen.getByRole('link', { name: /Go to my current portal/ })).toHaveAttribute(
      'href',
      '/parent/dashboard',
    )
  })
})
