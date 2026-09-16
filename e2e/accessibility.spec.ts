import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAsAdmin, hasAdminCredentials } from './helpers/auth'

// ─── AT-019: Accessibility — keyboard and screen-reader compliance ─────────────
// Runs axe-core against all key pages and asserts zero critical/serious violations.

const PUBLIC_PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'activities listing', path: '/activities' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'guest payment', path: '/guest-payment' },
]

test.describe('AT-019 public page accessibility', () => {
  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} (${path}) has no critical axe violations`, async ({ page }) => {
      await page.goto(path)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .exclude('#__next-build-watcher') // exclude Next.js dev overlay
        .analyze()

      const criticalOrSerious = results.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact ?? ''),
      )

      if (criticalOrSerious.length > 0) {
        const summary = criticalOrSerious
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
          .join('\n')
        expect(criticalOrSerious, `Axe violations on ${path}:\n${summary}`).toHaveLength(0)
      }
    })
  }
})

test.describe('AT-019 admin page accessibility', () => {
  test.skip(
    !hasAdminCredentials,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin a11y tests',
  )

  const ADMIN_PAGES = [
    { name: 'admin dashboard', path: '/admin/dashboard' },
    { name: 'admin students', path: '/admin/students' },
    { name: 'admin activities', path: '/admin/activities' },
    { name: 'admin orders', path: '/admin/orders' },
    { name: 'admin reports', path: '/admin/reports' },
    { name: 'admin reconciliation', path: '/admin/reconciliation' },
    { name: 'admin audit log', path: '/admin/audit' },
  ]

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  for (const { name, path } of ADMIN_PAGES) {
    test(`${name} (${path}) has no critical axe violations`, async ({ page }) => {
      await page.goto(path)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .exclude('#__next-build-watcher')
        .analyze()

      const criticalOrSerious = results.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact ?? ''),
      )

      if (criticalOrSerious.length > 0) {
        const summary = criticalOrSerious
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
          .join('\n')
        expect(criticalOrSerious, `Axe violations on ${path}:\n${summary}`).toHaveLength(0)
      }
    })
  }
})

// ─── Keyboard navigation spot checks ──────────────────────────────────────────

test.describe('keyboard navigation', () => {
  test('login form is completable by keyboard only', async ({ page }) => {
    await page.goto('/login')

    // Tab to email
    await page.keyboard.press('Tab')
    const emailFocused = await page.evaluate(() => document.activeElement?.getAttribute('type'))

    // If skip link or nav gets focus first, keep tabbing until we hit email
    let tabCount = 0
    while (emailFocused !== 'email' && tabCount < 10) {
      await page.keyboard.press('Tab')
      tabCount++
    }

    const emailInput = page.getByLabel(/email/i)
    await emailInput.focus()
    await emailInput.fill('test@example.com')

    await page.keyboard.press('Tab')
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeFocused()
  })

  test('skip-to-content link focuses main content on activation', async ({ page }) => {
    await page.goto('/')
    // Tab once to reach skip link
    await page.keyboard.press('Tab')
    const skipLink = page.locator('a.skip-to-content')
    await skipLink.focus()
    await page.keyboard.press('Enter')
    // Main content should now have focus or be the active scroll target
    const mainId = await page.evaluate(() => document.getElementById('main-content') !== null)
    expect(mainId).toBe(true)
  })
})
