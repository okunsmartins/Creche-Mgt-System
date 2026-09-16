/**
 * E2E tests for teacher management and payment link features.
 *
 * Prerequisites:
 *   - App running at PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 *   - Supabase seeded with migrations 001–018 (includes fictional teachers)
 *   - Admin credentials available via PLAYWRIGHT_ADMIN_EMAIL / PLAYWRIGHT_ADMIN_PASSWORD env vars
 *   - A published, active activity with class eligibility configured
 *
 * Tests use the fictional seed data from migration 017:
 *   teachers: Ms Ní Bhriain (Junior Infants), Mr Ó Dochartaigh (Senior Infants), …
 */

import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = process.env['PLAYWRIGHT_ADMIN_EMAIL'] ?? 'admin@scoilbhride.example.ie'
const ADMIN_PASSWORD = process.env['PLAYWRIGHT_ADMIN_PASSWORD'] ?? 'changeme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signInAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/admin/dashboard')
}

// ─── Teacher management ───────────────────────────────────────────────────────

test.describe('Teacher management', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page)
  })

  test('admin sidebar shows Teachers and Classes links', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('link', { name: 'Teachers' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Classes' })).toBeVisible()
  })

  test('teacher list page loads and shows seeded teachers', async ({ page }) => {
    await page.goto('/admin/teachers')
    await expect(page.getByRole('heading', { name: /teachers/i })).toBeVisible()
    // Seed data includes Ms Ní Bhriain and Mr Ó Dochartaigh
    await expect(page.getByText('Ní Bhriain')).toBeVisible()
    await expect(page.getByText('Ó Dochartaigh')).toBeVisible()
  })

  test('admin can navigate to create teacher form', async ({ page }) => {
    await page.goto('/admin/teachers')
    await page.getByRole('link', { name: /add teacher/i }).click()
    await expect(page.getByRole('heading', { name: /add teacher/i })).toBeVisible()
    await expect(page.getByLabel(/first name/i)).toBeVisible()
    await expect(page.getByLabel(/last name/i)).toBeVisible()
    await expect(page.getByLabel(/display name/i)).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
  })

  test('create teacher form shows validation errors for empty required fields', async ({
    page,
  }) => {
    await page.goto('/admin/teachers/new')
    await page.getByRole('button', { name: /save teacher/i }).click()
    await expect(page.getByText(/first name is required/i)).toBeVisible()
    await expect(page.getByText(/last name is required/i)).toBeVisible()
  })

  test('admin can create a new teacher', async ({ page }) => {
    await page.goto('/admin/teachers/new')
    await page.getByLabel(/first name/i).fill('Fionnuala')
    await page.getByLabel(/last name/i).fill('Ní Fhaoláin')
    await page.getByLabel(/display name/i).fill('Ms Ní Fhaoláin')
    await page.getByLabel(/email address/i).fill('fnifhaoláin@scoilbhride.example.ie')
    await page.getByRole('button', { name: /save teacher/i }).click()
    // Should redirect back to teacher list
    await page.waitForURL('/admin/teachers')
    await expect(page.getByText('Ní Fhaoláin')).toBeVisible()
  })

  test('admin can edit an existing teacher', async ({ page }) => {
    await page.goto('/admin/teachers')
    // Click the first Edit link in the table
    await page.getByRole('link', { name: /edit/i }).first().click()
    await expect(page.getByLabel(/first name/i)).not.toHaveValue('')
    // Change display name
    await page.getByLabel(/display name/i).fill('Ms Updated')
    await page.getByRole('button', { name: /save teacher/i }).click()
    await page.waitForURL('/admin/teachers')
    await expect(page.getByText('Ms Updated')).toBeVisible()
  })

  test('classes page shows teacher assignments', async ({ page }) => {
    await page.goto('/admin/classes')
    await expect(page.getByRole('heading', { name: /classes/i })).toBeVisible()
    // Each of the 8 classes should have a teacher assigned from seed data
    await expect(page.getByText('Junior Infants')).toBeVisible()
    await expect(page.getByText('Ní Bhriain')).toBeVisible()
  })
})

// ─── Payment links ────────────────────────────────────────────────────────────

test.describe('Payment links', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page)
  })

  test('admin sidebar shows Payment Links link', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('link', { name: 'Payment Links' })).toBeVisible()
  })

  test('payment links list page loads', async ({ page }) => {
    await page.goto('/admin/payment-links')
    await expect(page.getByRole('heading', { name: /payment links/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create link/i })).toBeVisible()
  })

  test('create payment link form shows validation errors for empty required fields', async ({
    page,
  }) => {
    await page.goto('/admin/payment-links/new')
    await page.getByRole('button', { name: /create link/i }).click()
    // Activity and label are required
    await expect(page.getByText(/label is required/i)).toBeVisible()
  })
})

// ─── Public payment link route ────────────────────────────────────────────────

test.describe('/pay/[token] public route', () => {
  test('invalid token format returns 404 or error page', async ({ page }) => {
    await page.goto('/pay/not-a-valid-token')
    // Page should not render the payment form for an invalid token
    const status = page.locator('text=/not found|invalid|expired|unavailable/i')
    await expect(status.first()).toBeVisible()
  })

  test('non-existent 64-char hex token shows link unavailable message', async ({ page }) => {
    const fakeToken = 'a'.repeat(64)
    await page.goto(`/pay/${fakeToken}`)
    await expect(page.getByText(/not available|expired|unavailable/i)).toBeVisible()
    // Must NOT reveal whether the token exists in the database (anti-enumeration)
    await expect(page.getByText(/not found in database/i)).not.toBeVisible()
  })
})
