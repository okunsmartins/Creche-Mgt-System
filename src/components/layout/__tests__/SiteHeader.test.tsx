import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/auth/actions', () => ({ signOutAction: vi.fn() }))

import { SiteHeader } from '../SiteHeader'

const mainNav = () => screen.getByRole('navigation', { name: 'Main navigation' })

describe('SiteHeader on the main Creche Wise site', () => {
  it('signed out: Sign in + Start free month, no portal button', () => {
    render(<SiteHeader />)
    const nav = within(mainNav())
    expect(nav.getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/login')
    expect(nav.getByRole('link', { name: 'Start free month' })).toBeInTheDocument()
    expect(nav.queryByRole('link', { name: /My portal/ })).toBeNull()
  })

  it('signed in to a crèche: stays on the main site with a "My portal" button', () => {
    render(<SiteHeader isAuthenticated portalHref="/admin/dashboard" />)
    const nav = within(mainNav())
    expect(nav.getByRole('link', { name: /About/ })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: /My portal/ })).toHaveAttribute('href', '/admin/dashboard')
    expect(nav.getByRole('button', { name: /Sign out/ })).toBeInTheDocument()
    expect(nav.queryByRole('link', { name: /Exit portal/ })).toBeNull()
  })

  it('inside a crèche page (/s/<slug>): crèche links, Admin and Exit portal', () => {
    render(<SiteHeader isTenant tenantSlug="angelsnest" schoolName="Angels Nest" isAuthenticated />)
    const nav = within(mainNav())
    expect(nav.getByRole('link', { name: 'Activities' })).toHaveAttribute(
      'href',
      '/s/angelsnest/activities',
    )
    expect(nav.getByRole('link', { name: /Exit portal/ })).toHaveAttribute('href', '/s/reset')
  })
})
