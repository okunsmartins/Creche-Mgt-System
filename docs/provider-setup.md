# Creche Wise — Provider & Deploy Setup (step by step)

The database was forked from Skool Bido, but the Twilio/Resend/Stripe config did **not**
carry over — SMS is **blank** and email is a **placeholder** in `.env.local`. So this is a
**fresh setup for Creche Wise**, not a migration. Nothing from Skool Bido needs un-wiring.
The SMS sender name ("SkoolBido") was Twilio-side config, not code — a new Twilio account
gets its own sender ID.

Order: **Email → (SMS) → Stripe → Vercel**. Email unblocks the most; SMS is optional at launch.

---

## Phase 1 — Email (Resend)  ⟶ invoices, arrears reminders, portal sign-up
1. Create a **Resend** account (resend.com).
2. **Domains → Add** `send.crechewise.com` (a subdomain, so the apex mail is untouched).
3. Add the **SPF / DKIM / DMARC** records Resend shows into **Cloudflare → crechewise.com → DNS** (grey cloud). Wait for **Verified**.
4. **API Keys → Create** → copy the `re_…` key.
5. Env (Vercel, Phase 4): `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS=noreply@send.crechewise.com`,
   `EMAIL_FROM_NAME=Creche Wise`, `SCHOOL_NOTIFICATION_EMAIL=<your inbox>`.

## Phase 2 — SMS (Twilio)  ⟶ text reminders (optional at launch; stays inert if unset)
1. Create a **Twilio** account + billing.
2. **Messaging → Create a Messaging Service** ("Creche Wise").
3. **Alphanumeric Sender ID** "CrecheWise" — requires **ComReg / A2P registration** for
   Ireland (can take days). Add the sender to the Messaging Service.
4. Status callback URL: `https://crechewise.com/api/webhooks/sms/status`.
5. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`,
   `TWILIO_STATUS_CALLBACK_URL`. Leave blank to keep SMS cleanly disabled.

## Phase 3 — Stripe  ⟶ subscriptions + FEE-08 payable invoices
1. Start in **test mode** (a test secret key is already in `.env.local`).
2. Create the **Pro product + prices**; copy the price IDs.
3. **Webhooks → Add endpoint** `https://crechewise.com/api/webhooks/stripe` → `STRIPE_WEBHOOK_SECRET`.
4. **Connect → enable**; add the Connect webhook endpoint → `STRIPE_CONNECT_WEBHOOK_SECRET`.
   This unblocks **FEE-08** (parents paying invoices); the instalment engine is ready to plug in.
5. Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`.

## Phase 4 — Vercel deploy
1. **New Project** from `okunsmartins/Creche-Mgt-System` (Next.js auto-detected; `vercel.json` present).
2. **Env vars (Production)** — from `.env.local` + provider values above, plus:
   `NEXT_PUBLIC_APP_URL=https://crechewise.com`, `APP_ENV=production`, `NODE_ENV=production`.
   **Do NOT set `NEXT_PUBLIC_SCHOOL_ID`** (that would force a single tenant).
   Keep `ENCRYPTION_KEY` identical to the one used to encrypt PPSN, or existing ciphertext won't decrypt.
3. Deploy → confirm the `*.vercel.app` URL shows the carousel.
4. **DNS**: add `crechewise.com` + `www` in Vercel → create the records in Cloudflare
   **DNS-only (grey cloud)** — orange/proxied caused 525 on Skool Bido.
5. **Supabase → Auth → URL Configuration**: Site URL `https://crechewise.com`,
   redirect `https://crechewise.com/**` (+ `www`).
6. Work through `docs/deploy-checklist.md` and smoke-test.

---

## Current config state (as of 2026-09-30)
| Provider | State | Working? |
|---|---|---|
| Twilio (SMS) | all `TWILIO_*` blank | ❌ inert until set (by design) |
| Resend (email) | placeholder key | ❌ won't send until real key + verified domain |
| Stripe | test secret key present; Connect webhook blank | ⚠️ partial; Connect needed for FEE-08 |

See also: `docs/domain-setup-crechewise.md`, `docs/deploy-checklist.md`,
`docs/setup/github-branch-protection.md`.
