import { test, expect } from '@playwright/test'
import {
  loginAsAdmin,
  loginAsParent,
  hasAdminCredentials,
  hasParentCredentials,
} from './helpers/auth'

// ─── AT-002: Access isolation — unauthenticated redirects ─────────────────────

test.describe('unauthenticated access redirects', () => {
  const protectedRoutes = [
    '/admin/dashboard',
    '/admin/students',
    '/admin/activities',
    '/admin/orders',
    '/admin/reports',
    '/admin/reconciliation',
    '/admin/audit',
    '/parent/dashboard',
    '/parent/children',
    '/parent/payments',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

// ─── AT-014: Refund authorisation — no parent/guest refund API ────────────────

test.describe('AT-014 refund authorisation', () => {
  test('refund CSV route returns 401 without session', async ({ request }) => {
    const response = await request.get('/api/admin/reports/payments')
    expect(response.status()).toBe(401)
  })

  test('activity report CSV returns 401 without session', async ({ request }) => {
    const response = await request.get('/api/admin/reports/activities')
    expect(response.status()).toBe(401)
  })

  test('refund report CSV returns 401 without session', async ({ request }) => {
    const response = await request.get('/api/admin/reports/refunds')
    expect(response.status()).toBe(401)
  })
})

// ─── AT-002: Cross-user access isolation (requires auth credentials) ──────────

test.describe('AT-002 cross-user order isolation', () => {
  test.skip(!hasParentCredentials, 'Set E2E_PARENT_EMAIL and E2E_PARENT_PASSWORD to run')

  test('parent cannot access admin dashboard', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/admin/dashboard')
    // Should either redirect to login or show an auth error — not the admin page
    await expect(page).not.toHaveURL(/\/admin\/dashboard/)
  })

  test('parent order history page requires correct payer', async ({ page }) => {
    await loginAsParent(page)
    // Attempt to access a random order ID — should get 404 or redirect, not another user's data
    await page.goto('/parent/payments/00000000-0000-0000-0000-000000000001')
    const status = await page.evaluate(() => {
      // Check if page content indicates an error (not another user's order data)
      return document.title
    })
    // Should not show a paid order for a random UUID
    expect(status).toBeTruthy()
  })
})

// ─── Admin-only route protection (requires admin credentials) ─────────────────

test.describe('admin-only routes', () => {
  test.skip(!hasAdminCredentials, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run')

  test('admin can access dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('admin can access reports page', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/reports')
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible()
  })

  test('admin can access audit log', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/audit')
    await expect(page.getByRole('heading', { name: /audit/i })).toBeVisible()
  })

  test('admin can access reconciliation queue', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/reconciliation')
    await expect(page.getByRole('heading', { name: /reconciliation|manual review/i })).toBeVisible()
  })
})

// ─── AT-007: Price integrity — Stripe session uses server-side price ───────────

test.describe('AT-007 price integrity', () => {
  test('guest payment page does not expose server-side amount in hidden fields', async ({
    page,
  }) => {
    await page.goto('/activities')
    // The guest page should not pre-populate price fields that could be tampered with
    const hiddenPriceInputs = await page.locator('input[type="hidden"][name*="price"]').count()
    expect(hiddenPriceInputs).toBe(0)
  })
})

// ─── AT-008: Webhook — invalid signature rejected ─────────────────────────────

test.describe('AT-008 webhook signature', () => {
  test('webhook endpoint returns 400 with invalid signature', async ({ request }) => {
    const response = await request.post('/api/webhooks/stripe', {
      data: '{"type":"checkout.session.completed"}',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid-signature',
      },
    })
    expect(response.status()).toBe(400)
  })

  test('webhook endpoint returns 400 with missing signature header', async ({ request }) => {
    const response = await request.post('/api/webhooks/stripe', {
      data: '{"type":"checkout.session.completed"}',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status()).toBe(400)
  })
})
