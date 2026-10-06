import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherForm } from '../TeacherForm'
import type { TeacherActionState } from '@/lib/teachers/schemas'

/**
 * Regression coverage for the staff "Active" toggle.
 *
 * The edit form carries `is_active` through a hidden input so that an unchecked
 * checkbox still submits an explicit value (plain unchecked checkboxes submit
 * nothing, which silently dropped deactivation). These tests assert that the
 * value the server action receives matches the checkbox state in both
 * directions.
 */
describe('TeacherForm – Active toggle', () => {
  const baseTeacher = {
    first_name: 'Áine',
    last_name: 'Ní Dhálaigh',
    display_name: null,
    email: 'aine@example.ie',
    is_active: true,
  }

  function setup(teacher: typeof baseTeacher) {
    const received: FormData[] = []
    const action = vi.fn(async (_prev: TeacherActionState, formData: FormData) => {
      received.push(formData)
      return null
    })
    render(<TeacherForm action={action} teacher={teacher} submitLabel="Save changes" />)
    return { action, received }
  }

  it('submits isActive="false" when an active teacher is unchecked', async () => {
    const user = userEvent.setup()
    const { action, received } = setup({ ...baseTeacher, is_active: true })

    const checkbox = screen.getByRole('checkbox', { name: /active/i })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(received[0]?.get('isActive')).toBe('false')
  })

  it('submits isActive="true" when an inactive teacher is checked', async () => {
    const user = userEvent.setup()
    const { action, received } = setup({ ...baseTeacher, is_active: false })

    const checkbox = screen.getByRole('checkbox', { name: /active/i })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(received[0]?.get('isActive')).toBe('true')
  })

  it('submits isActive="true" for an active teacher left untouched', async () => {
    const user = userEvent.setup()
    const { action, received } = setup({ ...baseTeacher, is_active: true })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(action).toHaveBeenCalledTimes(1)
    expect(received[0]?.get('isActive')).toBe('true')
  })
})
