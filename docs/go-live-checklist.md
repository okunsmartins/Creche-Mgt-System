# Go-Live Checklist — Creche Wise

The single "are we ready to launch?" list for **Creche Wise** (crechewise.com). Detail and history live in
[implementation-status.md](implementation-status.md).

**Legend:** `[x]` done & verified live · `[~]` built but not yet verified live · `[ ]` outstanding.
Only tick `[x]` for things actually verified in **production** (crechewise.com).

**Prod Supabase project:** `xpbavfutfejlfbmnntyl`. Always confirm this ref before running SQL.
**Migrations applied:** through **109** (`109_platform_settings.sql`). **110** (`110_close_anon_reads.sql`, PR #138) **applied 2026-11-20**. Next new migration = **111**.

---

## ⏱ End-of-month plan (target: launch by 30 Nov 2026)

Agreed 2026-11-19. "You" = owner; "Claude" = code/PRs (owner merges). Tick in a small PR as each one is done.

### Step 1: Start now (outside companies have lead times)
- [ ] **(You) Stripe live verification.** Finish business verification on the live "Creche Wise" account (currently *Restricted*). This blocks launch.
- [ ] **(You) ComReg** sender-ID registration for "CrecheWise" confirmed.
- [ ] **(You) Vercel Pro** (~$20/mo). The Hobby plan is non-commercial.
- [ ] **(You) GitHub Pro (~$4/mo), then make `Creche-Mgt-System` private.** Pro first, so `protect-main` keeps being enforced. Settings → General → Danger Zone → Change visibility.

### Step 2: Tests left (together, one step at a time)
- [ ] Revolut sandbox: connect Angels Nest → parent pays with "Pay with Revolut" → Paid + receipt (§3).
- [ ] Revolut: a declined card fails cleanly; a Revolut **refund** works (never run yet).
- [ ] Staff opening a parent link sees "This link is for parents" (PR #123).
- [ ] Admin → **Refunds** lists the four 14–15 Nov test fee refunds (after PR #136).

### Step 3: Settings (You, ~5 min each)
- [ ] Supabase: **Confirm email ON** + **MFA** for admins (§1).
- [ ] Vercel: **`ENCRYPTION_KEY`** set (§1).
- [x] Supabase SQL editor: **migration 110** applied 2026-11-20 (PR #138); `node scripts/anon-read-sweep.mjs` → only `activities` is public.

### Step 4: Code (Claude; PRs for you to merge)
- [x] **#10–12** fee refunds on Admin → Refunds + CSV; order-refund idempotency; Connect account check on `charge.refunded` ([PR #136](https://github.com/okunsmartins/Creche-Mgt-System/pull/136)).
- [x] **#13** invoice period running past the schedule end: **already fixed** by PR #119. Live invoices INV-2026-000027/-000028 show 1–30 Nov; only pre-fix INV-2026-000025 shows 5 Dec.
- [x] **#14** standalone cleanup (package `creche-wise`, no `skoolbido.com` in code) + local secret check (`npm run hooks:install`) ([PR #137](https://github.com/okunsmartins/Creche-Mgt-System/pull/137)).
- [x] **#15** security spot-checks: 3 public tables closed by migration 110 ([PR #138](https://github.com/okunsmartins/Creche-Mgt-System/pull/138), applied + re-checked); client-bundle secret scan **clean** (see §4).
- [x] **#16** this checklist updated with the verified 14–15 Nov tests.

### Step 5: Tidy-up before Tracy uses it for real
- [ ] Test child MichaelTest JordanTest: **void INV-2026-000028 and the 14 Nov €1 late fee** (owed again after the refund tests), set the child inactive, remove the owner's mobile.
- [ ] Ask Tracy to add **dates of birth** for the 3 children without one (Wobblers 2, Toddlers 1). Ratio checks can't count them otherwise.
- [ ] Tell Tracy about the 21 Oct test text (2 Angels Nest parents).
- [ ] (You) Privacy notice + DPIA reviewed for children's data (§4).

### Step 6: Launch day: see §5 below.

**Not this month (backlog):** Revolut-dashboard refund sync; dedicated refund rows for fee refunds; FEE-01 effective-dated rates; FEE-04 invoice lines; reminder sending; compliance centre (§7.7); AIM (stays off); Playwright E2E + security scans in CI; child meal options (mig 101, unmerged).

---


## 0. Automated test gate (every PR / deploy)

```bash
rm -rf .next/types && npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx prettier --check . && npx vitest run && npx next build
```

- [x] Type-check, lint, Prettier, unit tests (1,164+ passing), production build: run in CI on every PR.
- [x] Migration grant guard (`src/lib/__tests__/migration-grants.test.ts`, runs with the unit tests): every table needs a `service_role` grant; from migration 111 it must be in the same file (Supabase's 30 Oct 2026 change), and any grant to `anon` needs a `-- public-on-purpose` comment.
- [~] Local secret check: `npm run hooks:install` once per machine (PR #137). Blocks commits that add live-looking keys.
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
- [x] **`CRON_SECRET`** set (verified 2026-11-13: all 3 cron URLs return 401, not 503) — needed by the 3 scheduled jobs in `vercel.json`
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
- [x] Angels Nest admin → **Payment setup → Connect Stripe** (test) → status Active (`acct_1UT7A9DC1c381e61`).
- [x] Test parent pays an invoice with `4242 4242 4242 4242` → invoice **Paid** → parent gets "Payment received" email (INV-2026-000028, 14 Nov).
- [x] Late fee paid the same way (PAY-2026-000003, 14 Nov; "View your late fees" button).
- [x] Admin **refund** from Creche Wise → Stripe refund on the crèche's account + invoice back to issued + refund email (15 Nov).
- [x] Refund made **in the Stripe dashboard** → `charge.refunded` (connected-accounts webhook) updates Creche Wise + refund email (15 Nov).
- [x] Two **part refunds** (€0.50 + €0.50) on one payment → part refunded → refunded; nothing lost or doubled (15 Nov, after PR #134).
- [ ] The same card tests in **live** mode at launch (§5).

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
- [x] Time-off approval checks room cover: warning → Approve blocked → "Approve anyway" (audited `clash_override`), and the "no date of birth" note (15 Nov; temporary test rows deleted).

---

## 4. Security & privacy
- [x] Service-role queries scoped by `school_id`; cross-tenant isolation test passed live.
- [x] `/platform` gated by `PLATFORM_OWNER_EMAIL` (404 to everyone else).
- [x] Public (anon) key can't read tenant data: `node scripts/anon-read-sweep.mjs` (read-only). 2026-11-20: found `payment_links`, `activity_class_eligibility`, `activity_pupil_eligibility` publicly readable (inherited policies) → **migration 110 applied**; re-run shows only `activities` (public on purpose). Service-role reads unaffected.
- [x] No secrets in the client bundle (only `NEXT_PUBLIC_*`). 2026-11-20: production build of `main` @ `3c96a20`; 224 files in `.next/static` scanned for every server-only `.env.local` value (13) and for Stripe/Revolut/webhook/service-role/private-key patterns. **0 hits.**
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
- [ ] Test child "MichaelTest JordanTest": void INV-2026-000028 + the 14 Nov late fee (owed again after the refund tests), set inactive, remove the owner's mobile.
- [ ] Tell Tracy the 21 Oct test text reached 2 Angels Nest parents.

*Keep this file current: flip a box to `[x]` in a small PR when a step is verified live.*
