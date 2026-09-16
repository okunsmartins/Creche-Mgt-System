# Go-Live Checklist

Single launch-readiness gate for Skool Bido. Detailed context for every item lives in
[implementation-status.md](implementation-status.md) — this file is the consolidated "are we ready?"
list so nobody has to hunt through the log.

**Legend:** `[x]` done & verified · `[~]` built but NOT yet live-verified · `[ ]` outstanding.
Do **not** tick `[x]` for anything that hasn't actually been verified in the target (prod) environment.

**Prod Supabase project:** `jywkpenzhzzptsrntobf` ("PrimarySchoolPortal"). ⚠️ Always confirm this ref
before running SQL — a decoy project caused a real incident (see the log).

---

## 0. Automated test gate — run before every deploy

```bash
cd "Primary Management System"
npm run type-check && npm run lint && npx vitest run && npx prettier --check .
```

- [x] `type-check` (tsc) — 0 errors
- [x] `lint` (eslint, incl. tenant-scope rule) — 0 errors
- [x] `vitest` — 615 unit tests passing
- [x] `prettier --check .` — clean
- [ ] **Playwright E2E smoke** — set `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`, then run the e2e specs
      (admin routes load, attendance/compose UI). Skipped in CI without creds — run once against a
      seeded prod-like env before launch.

> Coverage gaps (documented, acceptable): integration paths (Stripe/Revolut webhooks, Resend send,
> Supabase writes) are not unit-tested — they're covered by the live tests in §3. The presentational
> pages (`/platform`, `FindYourSchool`, `SiteHeader`) have no component tests; their pure logic does.

---

## 1. Production configuration — toggles & secrets

### Supabase (prod `jywkpenzhzzptsrntobf`)
- [ ] **Admin MFA enabled** (Dashboard → Authentication → MFA) — flagged *Must, pre-production*
- [ ] **"Confirm email" ON** (Authentication → Providers → Email) — required for FR-AUTH-002 in prod
- [x] Migrations applied through **057** (SMS 055/056/057 verified via `to_regclass`)
- [x] `service_role` grants present (full 119-query tenant audit done 2026-07-17) — **re-verify** any
      table added since (sms_*, subscriptions.sms_enabled): grants + a service-role probe
- [ ] Auth redirect URLs point to the prod domain (`skoolbido.com`)

### Vercel environment variables (Production)
- [x] `PLATFORM_OWNER_EMAIL` set + `/platform` confirmed live
- [x] Supabase URL/keys, `NEXT_PUBLIC_APP_URL` = prod domain
- [ ] **Stripe LIVE keys** (currently sandbox) + live webhook secret
- [ ] **Revolut** prod `REVOLUT_API_KEY`, `REVOLUT_API_BASE_URL` (prod), `REVOLUT_WEBHOOK_SECRET`
- [ ] **Twilio** `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGING_SERVICE_SID` /
      `TWILIO_STATUS_CALLBACK_URL` (`https://skoolbido.com/api/webhooks/sms/status`)
- [ ] `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_ANNUAL_PRICE_ID` — **live-mode** ids
- [ ] `STRIPE_PRO_SMS_MONTHLY_PRICE_ID` / `STRIPE_PRO_SMS_ANNUAL_PRICE_ID` — **live-mode** ids
- [ ] `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` on a **verified** sending domain
- [ ] **`CRON_SECRET`** — required for the permission-slip due-date reminder cron
      (`GET /api/cron/permission-slip-reminders`, scheduled daily 08:00 UTC in
      `vercel.json`). Generate with `openssl rand -hex 32`; add for **Production**
      and redeploy. Vercel auto-sends it as `Authorization: Bearer <secret>`.
      **Until set, the endpoint returns 503 and no reminders send.** Verify in the
      project's **Cron Jobs** tab (job listed); optionally **Run** it — a healthy
      response is `{ "ok": true, "slips": 0, "emails": 0 }`.

> Reminder: env changes only take effect on a **fresh deploy** — redeploy after editing.

---

## 2. Third-party accounts & products

### Stripe (switch from sandbox to LIVE)
- [x] Sandbox Pro product + prices (€39.99/mo, €420/yr) + full trial→subscribe→webhook loop proven
- [ ] **Live-mode Pro** product + prices
- [ ] **Live-mode Pro + SMS** (€44.99) product + prices → drives `subscriptions.sms_enabled`
- [ ] **SMS credit top-up** products/prices (live)
- [ ] Live webhook endpoint registered + signing secret in Vercel

### Revolut
- [x] Integration built, merged, sandbox-configured (migrations 051/052, webhook secret, deployed)
- [ ] **Business KYC approved**
- [ ] Prod API key + prod base URL in Vercel

### Twilio (SMS) + ComReg
- [ ] Twilio account created (2FA — Irish number **without** the leading trunk `0`)
- [ ] Messaging Service created (`MG…` SID)
- [ ] `SkoolBido` alphanumeric Sender ID added
- [ ] **ComReg** Ireland sender-ID registration **approved** (mandatory since Oct 2025; has lead time)

### Resend (email)
- [ ] Sending domain **verified** (DNS records) so receipts/notifications deliver

---

## 3. Manual / live end-to-end tests (per feature)

### Payments & checkout
- [ ] Guest payment via a school's link (`/s/<school>/guest-payment` or `/pay/<token>`) → card → success page + **receipt email**
- [ ] Parent login → pay → order + receipt visible in portal
- [ ] **Instalments**: order ≥ €20 → 4 equal instalments; each payment advances balance
- [ ] Refund flow (admin) → Stripe refund + status + audit
- [ ] Payment cancelled / failed paths handled

### Subscriptions
- [x] Trial → lock → subscribe → webhook → active proven **in sandbox** (Scoil Demo Pro·Active)
- [ ] Re-verify the same loop in **live mode** with the live Pro product
- [ ] Dunning: `past_due` grace window + payment-failed email; `subscription.deleted` reverts to free

### Revolut
- [ ] Live sandbox **end-to-end** payment (the one remaining sandbox step) — success + error PANs
- [ ] Prod smoke once KYC + prod key are in

### SMS (needs Twilio + ComReg + Pro+SMS product first)
- [ ] Subscribe a school to Pro+SMS → webhook sets `sms_enabled` → compose UI unlocks (currently gated)
- [ ] Send to a test mobile → arrives from `SkoolBido` → **delivery webhook** flips
      `sms_notifications.status` to delivered
- [ ] Credit top-up checkout → `sms_topups` + balance increments (idempotent on webhook retry)
- [ ] Allowance/credit debit is correct; blocked at zero balance
- [ ] Opted-out parent is skipped

### Email
- [ ] Receipt to payer + school notification deliver (needs live Stripe + verified Resend domain)
- [ ] Per-tenant sender name shows the school's name

### Platform / multi-tenancy / privacy
- [x] Owner `/platform` renders the schools overview (verified in prod)
- [x] Public apex pages do **not** enumerate schools (verified in prod)
- [ ] Signed-in non-owner gets 404 on `/platform`
- [ ] Single-domain tenancy: bare apex = platform (anon); `/s/<school>/…` resolves that school (no
      sticky cookie); `/pay/<token>` resolves from the token; a logged-in school user lands on their school

### Attendance / activities / programmes / other modules
- [ ] Attendance: mark a roll + per-student summary
- [ ] Activities & programmes: create → publish → enrol → pay
- [ ] Meeting booking, time-off, messaging (email) smoke tests

---

## 4. Security review

- [ ] **OWASP Top-10** manual pass (SQLi, XSS/CSP, CSRF/SameSite, broken access control)
- [x] Tenant-scope audit of service-role queries (2026-07-17) — **re-run** for tables added since
      (sms_*, subscriptions, platform overview: the `/platform` cross-tenant read is intentional and
      sits behind `isPlatformOwner`)
- [ ] Confirm **RLS enabled** on every table (SMS tables: RLS on, no policies, service-role only)
- [ ] No secrets reachable from the client bundle (only `NEXT_PUBLIC_*`)
- [x] `/platform` gated by `PLATFORM_OWNER_EMAIL`; 404 (not 403) to non-owners

---

## 5. Domain / infrastructure
- [x] `skoolbido.com` apex + `www` live on Vercel (Cloudflare CNAMEs)
- [x] **Single-domain tenancy** — schools live on the apex via `/s/<school>` + tokens; **no per-school
      DNS/SSL to provision**, so onboarding is instant (Aladdin-style).
- [ ] Confirm `NEXT_PUBLIC_APP_URL` + Supabase Auth URLs use the prod domain everywhere
- [ ] Apply migration **059** (drop `schools.subdomain_provisioned`) — after this deploy

---

## 6. Revolut go-live — make live payments + refunds real (step by step)

The Revolut integration is **fully built and merged** (PR #43): create-order + hosted Revolut
Pay, the `ORDER_COMPLETED / ORDER_PAYMENT_DECLINED / ORDER_PAYMENT_FAILED / ORDER_CANCELLED`
webhook (HMAC-verified + idempotent, at `POST /api/webhooks/revolut`), and admin **refunds**
(`POST /orders/{id}/refund`). **Nothing new to code** — the remaining work is testing +
production credentials.

> **Decide first — one account or per-school?** The merged integration uses a **single**
> Revolut Merchant API key, so every Revolut payment lands in **one** Revolut account. Stripe
> is per-school (Connect); Revolut is **not**, yet. Per-school Revolut is the held
> `feat/revolut-per-school` branch (needs `ENCRYPTION_KEY`, migration 067, sandbox test). For a
> multi-school launch, choose: (a) go live single-account now — only if all Revolut funds are
> meant to land in one account; (b) finish per-school first; or (c) leave Revolut **off** at
> launch (leave `REVOLUT_API_KEY` unset → the option is hidden) since Stripe Connect already
> covers per-school card payments, and switch Revolut on later.

### 6a. Finish the sandbox proof (last pre-prod step)
- [ ] End-to-end sandbox payment: order → choose Revolut Pay → pay with success PAN
      `4929420573595709` → webhook `ORDER_COMPLETED` flips the order to **paid** + receipt email
      (sandbox already configured: migrations 051/052, webhook secret in Vercel).
- [ ] Failure path: pay with a declining PAN → order → `payment_failed`.
- [ ] Refund path: admin refund on the paid order → Revolut refund succeeds → order refunded +
      audit row.

### 6b. Revolut Business account + KYC (production)
- [ ] Revolut **Business** account created and **KYC approved** for the merchant that will
      receive the funds (First Stack Solutions, or the specific school if single-account).
- [ ] **Merchant API / Revolut Pay** enabled on that account (Revolut Merchant dashboard).

### 6c. Production credentials → Vercel (Production env)
- [ ] **Production Secret API key** (Merchant → APIs) → set `REVOLUT_API_KEY`.
- [ ] `REVOLUT_API_BASE_URL` = `https://merchant.revolut.com/api/1.0` (prod; sandbox is
      `https://sandbox-merchant.revolut.com/api/1.0`).
- [ ] Create a **production webhook** in the Revolut dashboard → URL
      `https://skoolbido.com/api/webhooks/revolut`, subscribed to `ORDER_COMPLETED`,
      `ORDER_PAYMENT_DECLINED`, `ORDER_PAYMENT_FAILED`, `ORDER_CANCELLED`. Copy its **signing
      secret** → set `REVOLUT_WEBHOOK_SECRET`.
- [ ] **Redeploy** — env changes only take effect on a fresh deploy.

### 6d. Production smoke test (real money, small amount)
- [ ] Small real order → pay by Revolut Pay → order flips to **paid** + receipt email; confirm
      the webhook row shows `processed = true` in `webhook_events`.
- [ ] Refund it from the admin → Revolut refund completes → order refunded.
- [ ] Then flip the Revolut boxes in §2 and §3 to `[x]`.

---

## Not blocking launch (tracked separately)
- **Go-to-market validation** paused until ~8 principals confirm a wedge (see `docs/market-validation.md`).
- Per-school **subdomains dropped** in favour of single-domain tenancy — no per-school DNS to manage.
  (Existing `<school>.skoolbido.com` links still resolve via host-based `getTenantSubdomain`, kept for
  backward compat; the provisioning automation was removed.)
- Platform **"Get in Touch"** page (needs a support email) + FAQ copy sign-off (support hours, hosting region).

---

*Keep this file current: when a live test passes or a config step is done, flip its box to `[x]` in a
small PR. When everything above is `[x]`, we're launch-ready.*
