# Creche Wise — Pre-Deploy Checklist

Companion to [domain-setup-crechewise.md](domain-setup-crechewise.md). Work top to bottom
before the first production deploy to Vercel.

## Code readiness
- [x] **Dev-only seed route removed** (`src/app/api/dev/` deleted — it bypassed auth to
      provision tenants/unlock Pro; must never ship).
- [x] `vercel.json` present (framework, `npm ci` install, `npm run build`, region `dub1`,
      security headers, permission-slip-reminders cron).
- [x] CI green on `main` (lint / type-check / format / unit tests / build).
- [x] `npm run build` passes (✓ Compiled successfully; all routes incl. arrears/check-in/ratios/fees; no `/api/dev`).

## Supabase (project `xpbavfutfejlfbmnntyl`)
- [ ] Migrations 001–075 applied (068–075 confirmed applied this session).
- [ ] RLS verified: `node scripts/verify-tenant-isolation.mjs` → all pass; no table
      readable via the anon key (re-confirm after deploy).
- [ ] **Auth → URL Configuration**: Site URL `https://crechewise.com`; redirect
      `https://crechewise.com/**` (+ `www`). See domain runbook §3.

## Vercel environment variables (Production)
Required:
- [ ] `NEXT_PUBLIC_APP_URL=https://crechewise.com`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ENCRYPTION_KEY` (same value used to encrypt PPSN — must match, or existing ciphertext won't decrypt)
- [ ] `CRON_SECRET`
- [ ] `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (defaults "Creche Wise"), `RESEND_API_KEY`,
      `SCHOOL_NOTIFICATION_EMAIL` — once the Resend sending domain is verified
- [ ] `PLATFORM_OWNER_EMAIL`, `APP_ENV=production`, `NODE_ENV=production`
Deferred (only when those features go live):
- [ ] Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `STRIPE_CONNECT_WEBHOOK_SECRET`, Pro price IDs — needed for subscriptions + FEE-08 invoice pay
- [ ] Twilio: `TWILIO_*` — needed for SMS reminders

**Never set** `NEXT_PUBLIC_SCHOOL_ID` in production (forces a single tenant); leave blank for multi-tenant.

## DNS (Cloudflare → crechewise.com) — see domain runbook §2
- [ ] Apex + `www` records pointing at Vercel, **DNS-only (grey cloud)**.
- [ ] Domains show **Valid** in Vercel.

## Post-deploy smoke test
- [ ] `https://crechewise.com` → carousel landing.
- [ ] Admin sign-in → dashboard; Import, Fees & Invoices, Arrears, Ratios, Daily Check-in render.
- [ ] Guest payment page loads for a tenant.
- [ ] `node scripts/verify-tenant-isolation.mjs` against prod DB → all pass.

## Repo hygiene (do once)
- [ ] Enable **branch protection** on `main` (require the 4 CI checks; no bypass) —
      see `docs/setup/github-branch-protection.md`.
- [ ] Confirm `.env.local`, `creche-dev-credentials.local.txt`, `Password/` are gitignored (they are).
