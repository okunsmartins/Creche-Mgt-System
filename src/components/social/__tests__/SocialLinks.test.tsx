import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialLinks } from '../SocialLinks'

/**
 * The footer / sign-in social buttons. Saved links must be safe external links;
 * placeholders must never be clickable; an all-placeholder row is decorative.
 */
describe('SocialLinks', () => {
  const links = [
    { key: 'facebook' as const, url: 'https://facebook.com/angelsnest' },
    { key: 'instagram' as const, url: 'https://www.instagram.com/angelsnest' },
  ]

  it('renders nothing when there are no links and no placeholders', () => {
    const { container } = render(<SocialLinks links={[]} schoolName="Angels Nest" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders saved links as safe new-tab links with descriptive labels', () => {
    render(<SocialLinks links={links} schoolName="Angels Nest" />)
    const fb = screen.getByRole('link', { name: /Angels Nest on Facebook/ })
    expect(fb).toHaveAttribute('href', 'https://facebook.com/angelsnest')
    expect(fb).toHaveAttribute('target', '_blank')
    expect(fb).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('list', { name: 'Angels Nest on social media' })).toBeInTheDocument()
  })

  it('with placeholders shows all six networks but only saved ones are links', () => {
    const { container } = render(
      <SocialLinks links={links} schoolName="Angels Nest" showPlaceholders />,
    )
    expect(container.querySelectorAll('li')).toHaveLength(6)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(container.querySelector('[title="TikTok — not set up yet"]')).not.toBeNull()
  })

  it('hides an all-placeholder row from assistive tech (nothing to follow yet)', () => {
    const { container } = render(
      <SocialLinks links={[]} schoolName="Creche Wise" showPlaceholders />,
    )
    const list = container.querySelector('ul')!
    expect(list).toHaveAttribute('aria-hidden', 'true')
    expect(list).not.toHaveAttribute('aria-label')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
