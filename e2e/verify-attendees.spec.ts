import { test, expect } from '@playwright/test'
import { loginAsAdmin, hasAdminCredentials } from './helpers/auth'

test.describe('Activity attendees & email feature', () => {
  test.skip(!hasAdminCredentials, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD required')

  test('Attendees button appears on activity edit page and attendees page loads', async ({
    page,
  }) => {
    await loginAsAdmin(page)

    // Go to activities list
    await page.goto('/admin/activities')
    await page.waitForLoadState('networkidle')

    // Click the first activity's edit link
    const firstEditLink = page.getByRole('link', { name: /edit/i }).first()
    await firstEditLink.click()
    await page.waitForLoadState('networkidle')

    // Confirm "Attendees & email" button is visible
    const attendeesBtn = page.getByRole('link', { name: /attendees/i })
    await expect(attendeesBtn).toBeVisible()

    // Click it
    await attendeesBtn.click()
    await page.waitForLoadState('networkidle')

    // URL should contain /attendees
    expect(page.url()).toContain('/attendees')

    // Stats bar should be present
    await expect(page.getByText('Enrolled')).toBeVisible()
    await expect(page.getByText('Paid in full')).toBeVisible()
    await expect(page.getByText('Awaiting payment')).toBeVisible()

    // Table headers
    await expect(page.getByRole('columnheader', { name: /Child/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Parent email/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Payment/i })).toBeVisible()

    // Email panel toggle
    const emailToggle = page.getByRole('button', { name: /email parents/i })
    if (await emailToggle.isVisible()) {
      await emailToggle.click()
      await expect(page.getByLabel(/Subject/i)).toBeVisible()
      await expect(page.getByLabel(/Message/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /Send/i })).toBeVisible()
    }
  })
})
