# Go-Live Checklist — Creche Wise

The single "are we ready to launch?" list for **Creche Wise** (crechewise.com). Detail and history live in
[implementation-status.md](implementation-status.md).

**Legend:** `[x]` done & verified live · `[~]` built but not yet verified live · `[ ]` outstanding.
Only tick `[x]` for things actually verified in **production** (crechewise.com).

**Prod Supabase project:** `xpbavfutfejlfbmnntyl`. Always confirm this ref before running SQL.
**Migrations applied:** through **109** (`109_platform_settings.sql`). Next new migration = **110**.

---

## 0. Automated test gate (every PR / deploy)

```bash
rm -rf .next/types && npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx prettier --check . && npx vitest run && npx next build
```

- [x] Type-check, lint, Prettier, unit tests (1,122+ passing), production build: run in CI on every PR.
- [ ] **Playwright E2E** (currently **skipped** in CI). To switch on: in GitHub → Settings → Secrets and variables →
      Actions, add secrets `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_PARENT_EMAIL`,
      `E2E_PARENT_PASSWORD` (a **test** admin + **test** parent, never real people) and variable `E2E_ENABLED=true`.

---

## 1. Production configuration

### Supabase (`xpbavfutfejlfbmnntyl`)
- [x] Auth emails (sign-up, reset) sent via **Resend SMTP** (`noreply@crechewise.com`); password reset verified live.
- [x] Auth Site URL / redirect URLs use `https://crechewise.com`.
- [ ] **"Confirm email" ON** (Authentication → Sign In / Providers → Email).
- [ ] **MFA** available for admins (Authentication → MFA).

### Vercel environment variables (Production) — redeploy after any change
- [x] Supabase URL / anon key / service-role key; `NEXT_PUBLIC_APP_URL=https://crechewise.com`.
- [x] `PLATFORM_OWNER_EMAIL` (platform owner gets `/platform` + portal notifications).
- [x] `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` — domain `crechewise.com` **verified** in Resend.
- [x] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_STATUS_CALLBACK_URL` — SMS
      delivered live as "CrecheWise" and the status callback updates.
- [ ] **`ENCRYPTION_KEY`** set (encrypts each crèche's Revolut key). **Never change it once crèches have connected.**
- [ ] **`CRON_SECRET`** set — needed by the 3 scheduled jobs in `vercel.json`
      (`permission-slip-reminders` daily 08:00, `funding-scans` daily 06:30, `ncs-weekly-compliance` Mon 07:00 UTC).
      Without it they return 503. Check Vercel → Cron Jobs → Run → expect `{ "ok": true, … }`.
- [ ] **Stripe LIVE**: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID` (+ `STRIPE_PRO_ANNUAL_PRICE_ID` if offered).
      Currently **test mode**.
- [ ] **`REVOLUT_API_BASE_URL=https://merchant.revolut.com/api/1.0`** at go-live (unset = sandbox, shows "Test mode").

> **Changing the subscription price (e.g. €75 → €49.99):** no code change. Create a new monthly Price on the Pro
> product in Stripe, put its id in `STRIPE_PRO_MONTHLY_PRICE_ID`, redeploy. The homepage, pricing page and subscribe
> button read the price live from Stripe. Existing subscribers stay on their old price unless moved in Stripe.

---

## 2. Third-party accounts

### Stripe (platform subscription + per-crèche card payments via Connect)
- [ ] Stripe account **activated for live** (business verification done).
- [ ] **Live** Pro product + monthly price (€75 now; €49.99 option later).
- [ ] **Live** webhooks: two endpoints, both `https://crechewise.com/api/webhooks/stripe`. One listens to
      **your account** (secret → `STRIPE_WEBHOOK_SECRET`), the other to **connected accounts** (secret →
      `STRIPE_CONNECT_WEBHOOK_SECRET`).
- [ ] Connect branding (name, icon, colour) set in **live** mode.

### Revolut (per-crèche — each crèche connects its OWN Revolut Business account)
- [x] Built: one-key connect, auto webhook, "Pay with Revolut" on invoices / late fees / extras (PRs #125, #128).
- [x] Admin instructions point to the **API Console**; keys are `r_test_…` / `r_prod_…`; crèches must use a
      **Merchant-only** key (Orders + Webhooks = Write) so Production never needs request signing.
      See [revolut-setup.md](revolut-setup.md).
- The platform owner does **not** need a Revolut account for payments (only for the free Sandbox to test).

### SMS (Twilio + ComReg)
- [x] Twilio Messaging Service with "CrecheWise" alphanumeric sender; live text delivered.
- [ ] **ComReg** sender-ID registration for "CrecheWise" confirmed/approved (mandatory in Ireland; has lead time).

---

## 3. Live end-to-end tests

### Payments — card (Stripe, test mode first)
- [ ] Angels Nest admin → **Payment setup → Connect Stripe** (test) → status Active.
- [ ] Test parent pays an invoice with `4242 4242 4242 4242` → invoice **Paid** → parent gets "Payment received" email.
- [ ] Late fee paid the same way.
- [ ] Admin **refund** → Stripe refund + status updated.

### Payments — Revolut (sandbox first)
- [ ] API Console → Sandbox → Merchant key → Angels Nest **Connect Revolut** → "Connected".
- [ ] Sandbox **Revolut Checkout → Card** switched ON (off by default).
- [ ] Test parent → **Pay with Revolut** → card `4929 4205 7359 5709` → invoice **Paid** + receipt email.
- [ ] A declining card → payment fails cleanly, invoice stays unpaid.

### Platform subscription
- [x] Trial → lock → subscribe → webhook → active, in **test** mode (Angels Nest).
- [ ] Same loop with the **live** price (real card, then cancel/refund if needed).

### Already verified live
- [x] Password reset email + new password works.
- [x] SMS to a parent ("Text parents") delivered.
- [x] Cross-tenant privacy test **64/64** (`ISO_CHILD_ID=<test child> node scripts/verify-tenant-isolation.mjs`).
- [x] Overpayment flagged + emailed to the crèche; receipts go to all linked parents (PR #122, unit-tested).
- [ ] Staff opening a parent link sees the "This link is for parents" notice (PR #123) — check live.

---

## 4. Security & privacy
- [x] Service-role queries scoped by `school_id`; cross-tenant isolation test passed live.
- [x] `/platform` gated by `PLATFORM_OWNER_EMAIL` (404 to everyone else).
- [ ] RLS enabled on every table (spot-check in Supabase → Table editor).
- [ ] No secrets in the client bundle (only `NEXT_PUBLIC_*`).
- [ ] DPIA + privacy notice reviewed for children's data.

### 4a. AIM module — keep OFF until signed off
AIM data is special-category data about children. `funding.manage_aim` is ungranted by default (404 for everyone).
Before granting it: documented lawful basis + consent, DPIA, least-privilege (named coordinators only), staff briefed
to keep summaries brief and non-clinical, retention rule defined, `aim.*` audit events checked, then a controlled
end-to-end test.

---

## 5. Launch day
1. Stripe → live keys, live price, live webhooks in Vercel; redeploy.
2. `REVOLUT_API_BASE_URL` → production; redeploy. Crèches reconnect with a **Production** Merchant-only key.
3. Angels Nest: reconnect Stripe (live) and Revolut (production); **cancel the test subscription**.
4. Switch off the owner's test crèche (**Flomat**).
5. Real **€1 invoice** by card → Paid + receipt; real subscription; real Revolut payment. Refund the test payments.
6. Onboard Angels Nest (Tracy) for real.

---

## Housekeeping (not blocking)
- [ ] Test child "MichaelTest JordanTest": set inactive, remove the owner's mobile.
- [ ] Tell Tracy the 21 Oct test text reached 2 Angels Nest parents.

*Keep this file current: flip a box to `[x]` in a small PR when a step is verified live.*
