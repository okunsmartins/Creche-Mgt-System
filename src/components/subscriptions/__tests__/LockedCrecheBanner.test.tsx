import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/stripe/subscriptionActions', () => ({
  createSubscriptionCheckoutAction: vi.fn(),
}))

import { LockedCrecheBanner } from '../LockedCrecheBanner'

const base = { trialDays: 30, priceId: 'price_123', priceLabel: '€75' }

describe('LockedCrecheBanner', () => {
  it('admin: names the crèche and shows the subscribe button', () => {
    render(
      <LockedCrecheBanner
        {...base}
        banner={{ kind: 'admin', reason: 'trial_ended', schoolName: 'Little Acorns' }}
      />,
    )
    const banner = screen.getByTestId('locked-creche-banner')
    expect(within(banner).getByText('Little Acorns')).toBeInTheDocument()
    expect(banner).toHaveTextContent('Your 30-day free trial has ended. Subscribe to unlock it')
    expect(screen.getByRole('button', { name: /Subscribe — €75\/month/ })).toBeInTheDocument()
  })

  it('staff/parent: names the crèche, no button, points to the manager', () => {
    render(
      <LockedCrecheBanner
        {...base}
        banner={{ kind: 'member', reason: 'trial_ended', schoolName: 'Little Acorns' }}
      />,
    )
    expect(screen.getByTestId('locked-creche-banner')).toHaveTextContent(
      /Little Acorns.*contact your crèche manager/,
    )
    expect(screen.queryByRole('button', { name: /Subscribe/ })).toBeNull()
  })

  it('signed out: generic message without a name or button', () => {
    render(<LockedCrecheBanner {...base} banner={{ kind: 'generic', reason: 'trial_ended' }} />)
    expect(screen.getByText(/free trial has ended/)).toBeInTheDocument()
    expect(screen.queryByTestId('locked-creche-banner')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('no button when no Stripe price is configured', () => {
    render(
      <LockedCrecheBanner
        {...base}
        priceId={undefined}
        banner={{ kind: 'admin', reason: 'trial_ended', schoolName: 'Little Acorns' }}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing when not locked', () => {
    const { container } = render(<LockedCrecheBanner {...base} banner={{ kind: 'none' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
