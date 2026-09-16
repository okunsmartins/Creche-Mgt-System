import type { Page } from '@playwright/test'

const TEST_ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? ''
const TEST_ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? ''
const TEST_PARENT_EMAIL = process.env['E2E_PARENT_EMAIL'] ?? ''
const TEST_PARENT_PASSWORD = process.env['E2E_PARENT_PASSWORD'] ?? ''

export const hasAdminCredentials = Boolean(TEST_ADMIN_EMAIL && TEST_ADMIN_PASSWORD)
export const hasParentCredentials = Boolean(TEST_PARENT_EMAIL && TEST_PARENT_PASSWORD)

export async function loginAsAdmin(page: Page): Promise<void> {
  if (!hasAdminCredentials) throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set')
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 10_000 })
}

export async function loginAsParent(page: Page): Promise<void> {
  if (!hasParentCredentials) throw new Error('E2E_PARENT_EMAIL and E2E_PARENT_PASSWORD must be set')
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(TEST_PARENT_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_PARENT_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/parent\/dashboard/, { timeout: 10_000 })
}

export async function logout(page: Page): Promise<void> {
  // Submit the sign-out form via direct navigation or button
  const signOutButton = page.getByRole('button', { name: /sign out|log out/i })
  if (await signOutButton.isVisible()) {
    await signOutButton.click()
  } else {
    await page.goto('/api/auth/signout')
  }
}
