# Security Design

## Threat model summary

| Threat | Mitigation |
|--------|-----------|
| Price manipulation | Server always fetches prices from DB; client values ignored |
| Student enumeration | Generic error messages for pupil-code lookups |
| IDOR on orders / payments | RLS policies + server-side ownership checks |
| Stripe webhook spoofing | Signed webhook verification (`stripe.webhooks.constructEvent`) |
| Duplicate payment events | `webhook_events` unique constraint on `(provider, event_id)` |
| Credential exposure | Service role key server-side only; never in client bundle |
| SQL injection | All DB access via Supabase client (parameterised queries) |
| Mass assignment | Explicit field allow-lists in every server action |
| XSS | Next.js default output encoding; strict CSP |
| CSRF | Server Actions use Next.js built-in CSRF protection |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` in CSP |
| Secrets in logs | `logging.ts` sanitises known sensitive keys before writing |

## Authentication

- Supabase email + password auth
- Email verification required before payment features accessible
- Secure password reset via time-limited token (Supabase built-in)
- Session stored in HttpOnly Supabase cookie
- Session refreshed on every request by middleware

## Authorisation layers

Three independent enforcement layers — UI alone is not trusted:

1. **Middleware** (`src/middleware.ts`) — redirects unauthenticated users from protected routes
2. **Server actions / route handlers** — call `requireAuth()` and `requirePermission()` before any operation
3. **Database RLS** — enforced at the PostgreSQL layer regardless of application code

## Row Level Security policy categories

- `parents_*` — parents see only their own orders/items/payments/students
- `admins_*` — role-permissioned access to all school data
- `teachers_*` — class-scoped student visibility only
- `anon_*` — only published activities and class names visible to guests

## Content Security Policy

Allows:
- `script-src`: self, inline (Next.js hydration), Stripe JS
- `frame-src`: Stripe Checkout domains
- `connect-src`: self, Supabase project URL, Stripe API

Blocks:
- External images (except `data:` and `https:`)
- Object embeds
- Inline event handlers (after hydration layer removed — future tightening)

## Sensitive data rules

- Card numbers, CVV, full PAN: **never stored** (Stripe tokenises these)
- Stripe secret key: **server-side only**, never in `NEXT_PUBLIC_` variables
- Service role key: **server-side only**, never in `NEXT_PUBLIC_` variables
- Pupil full names: not stored in Stripe metadata; only internal IDs
- Logs: `logging.ts` redacts keys matching: `password`, `token`, `secret`, `key`, `card`, `cvv`, `cvc`, `pan`, `stripe_secret`, `service_role`

## Audit logging

Sensitive admin actions are appended to `audit_logs` (append-only, no UPDATE/DELETE policies):
- Student CRUD
- Parent-student linking
- Activity publication
- Payment reconciliation
- Refunds
- Report exports
- Role changes

## Known dependency vulnerability status (as of 2026-06-15)

Two vulnerability chains exist in dev dependencies. Neither affects the production build.

### 1. esbuild ≤0.28.0 — inside Vitest/Vite chain (dev only)

- **CVEs:** GHSA-g7r4-m6w7-qqqr, GHSA-gv7w-rqvm-qjhr
- **Severity:** High (dev server file-read on Windows; Deno binary verification issue)
- **Impact:** Only the developer's local machine while running `npm test` or `vitest`
- **Production impact:** None — esbuild/vite are not included in the Vercel build
- **Resolution:** Fixing requires `@vitejs/plugin-react@6` → `vite@8`, but Vitest 3.x pins `vite@4–6`. Incompatible peer tree. Will resolve when Vitest 4.x stabilises with a compatible plugin-react.
- **Action:** Developers should not run the test suite while exposing the dev machine to untrusted local networks.

### 2. postcss <8.5.10 — inside Next.js bundle (internal)

- **CVE:** GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>` in CSS stringify output)
- **Severity:** Moderate
- **Impact:** Only triggered if attacker-controlled CSS is passed through PostCSS stringify — not applicable to this application (CSS is authored, not user-generated)
- **Production impact:** None for this use case
- **npm audit fix suggestion:** Downgrade to `next@9.3.3` — this is incorrect; the vulnerability is in Next.js's internal bundled PostCSS, not the project's own PostCSS dependency. We are on the latest Next.js release.
- **Action:** Monitor Next.js releases for an internal PostCSS patch.

---

## Production security checklist (pre-launch)

- [ ] Replace Stripe test keys with live keys
- [ ] Verify Stripe webhook signing secret matches Vercel environment
- [ ] Enable Supabase project MFA for admin accounts
- [ ] Tighten CSP `unsafe-inline` / `unsafe-eval` after Next.js nonce support confirmed
- [ ] Add `Strict-Transport-Security` header (automatic on Vercel HTTPS)
- [ ] Review Supabase Row Level Security policies with penetration tester
- [ ] Enable Supabase Database Vault for secrets (optional)
- [ ] Configure Vercel WAF (if on Pro plan)
- [ ] Complete GDPR Data Protection Impact Assessment
- [ ] Sign Data Processing Agreements with Supabase, Stripe, Resend, Vercel
