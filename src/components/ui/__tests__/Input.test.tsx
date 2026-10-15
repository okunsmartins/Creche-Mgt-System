import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input', () => {
  it('password fields get a show/hide toggle that switches the input type', async () => {
    render(<Input label="Password" name="password" type="password" />)
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(field).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('non-password fields have no toggle', () => {
    render(<Input label="Email" name="email" type="email" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders an optional left icon (decorative) and pads the field for it', () => {
    render(<Input label="Email" name="email" leftIcon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('Email').className).toContain('pl-10')
  })
})
