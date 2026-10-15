import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RainbowText } from '../RainbowText'

describe('RainbowText', () => {
  it('gives screen readers the plain word and hides the coloured letters', () => {
    const { container } = render(<RainbowText text="joyful." />)
    expect(container.querySelector('.sr-only')).toHaveTextContent('joyful.')
    const visual = container.querySelector('[aria-hidden="true"]')!
    expect(visual.children).toHaveLength(7)
    expect(container.querySelector('.cw-letters')).toBeNull()
  })

  it('staggers the letter bounce when animateFrom is set', () => {
    const { container } = render(<RainbowText text="ab" animateFrom={350} />)
    expect(container.querySelector('.cw-letters')).not.toBeNull()
    const letters = container.querySelectorAll('[aria-hidden="true"] > span')
    expect((letters[0] as HTMLElement).style.animationDelay).toBe('350ms')
    expect((letters[1] as HTMLElement).style.animationDelay).toBe('440ms')
  })
})
