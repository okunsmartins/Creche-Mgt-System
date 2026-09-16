import { test, expect } from '@playwright/test'

// ─── Public pages (no auth required) ─────────────────────────────────────────

test.describe('homepage', () => {
  test('loads and shows the portal name', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Scoil Demo/)
  })

  test('has a skip-to-content link', async ({ page }) => {
    await page.goto('/')
    const skip = page.locator('a.skip-to-content')
    await expect(skip).toBeAttached()
    await expect(skip).toHaveAttribute('href', '#main-content')
  })

  test('shows a call-to-action link to activities', async ({ page }) => {
    await page.goto('/')
    const ctaLink = page.getByRole('link', { name: /view activities|pay now|activities/i }).first()
    await expect(ctaLink).toBeVisible()
  })
})

test.describe('public activities page', () => {
  test('loads without a 4xx or 5xx error', async ({ page }) => {
    const response = await page.goto('/activities')
    expect(response?.status()).toBeLessThan(400)
  })

  test('has an accessible page heading', async ({ page }) => {
    await page.goto('/activities')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })
})

test.describe('login page', () => {
  test('loads and shows email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('shows a link to the registration page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /register|sign up|create account/i })).toBeVisible()
  })
})

test.describe('registration page', () => {
  test('loads and shows the registration form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByLabel(/first name/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })
})

// ─── AT-018: mobile viewport — core journey without horizontal scrolling ──────

test.describe('AT-018 mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('homepage fits within mobile viewport without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1) // 1px tolerance
  })

  test('activities page fits within mobile viewport', async ({ page }) => {
    await page.goto('/activities')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('login page fits within mobile viewport', async ({ page }) => {
    await page.goto('/login')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })
})
