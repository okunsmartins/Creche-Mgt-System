# Domain & Deploy Runbook — crechewise.com

Go-live wiring for the Creche Wise platform. Mirrors the Skool Bido domain setup,
with the lessons learned baked in.

**Status:** ✅ `crechewise.com` **registered** on Cloudflare Registrar (2026-09-30) —
WHOIS privacy on, auto-renew on. A DNS zone was auto-created. Nothing else needed on
the domain until the app is deployed.

---

## 1. Deploy the app to Vercel (do first — the domain points here)
1. **Create a Vercel project** from the GitHub repo `okunsmartins/Creche-Mgt-System`
   (Framework: Next.js; root: repo root; Node build = `next build`).
2. **Environment variables** — copy from `.env.local` into Vercel (Production), swapping
   the placeholders for live values:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     (the crèche Supabase project `xpbavfutfejlfbmnntyl`).
   - `NEXT_PUBLIC_APP_URL=https://crechewise.com`  ← currently `http://localhost:3000`.
   - `ENCRYPTION_KEY`, `CRON_SECRET`.
   - `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (defaults to "Creche Wise"), Resend key —
     once the sending domain is verified (see §4).
   - Stripe / Revolut / Twilio keys when those go live (not required for first deploy).
3. Deploy; confirm the `*.vercel.app` URL renders (carousel landing + sign-in).

## 2. Point crechewise.com at Vercel (Cloudflare DNS)
In **Vercel → Project → Settings → Domains**, add `crechewise.com` and `www.crechewise.com`.
Vercel shows the DNS records to create. In **Cloudflare → crechewise.com → DNS → Records**:
- Apex `crechewise.com` → the A record (or `CNAME @` flattening) Vercel gives.
- `www` → `CNAME` to `cname.vercel-dns.com` (or as Vercel specifies).
- **Set every record to DNS-only (grey cloud), NOT proxied (orange).**
  ⚠️ On Skool Bido, proxied/orange + the registrar setup caused **525** errors; grey works.
- Wait for Vercel to show the domains as **Valid/Assigned** (minutes).

## 3. Update auth/redirect URLs
- **Supabase → Authentication → URL Configuration:**
  - Site URL: `https://crechewise.com`
  - Redirect URLs: add `https://crechewise.com/**` (and `https://www.crechewise.com/**`).
- Redeploy if `NEXT_PUBLIC_APP_URL` changed after the first deploy.

## 4. Email deliverability (for invoices, reminders, portal sign-up)
- Verify a **Resend sending domain** (e.g. `send.crechewise.com`): add the SPF/DKIM/DMARC
  records Resend provides into Cloudflare DNS (grey). See `reference_resend_domain_verification`.
- Set `EMAIL_FROM_ADDRESS=noreply@send.crechewise.com` once verified.

## 5. Per-crèche subdomains (tenant portals) — later
The app supports tenant portals two ways:
- **Path-based:** `crechewise.com/s/<crèche>` — works with no extra DNS. Simplest.
- **Per-subdomain:** `<crèche>.crechewise.com` — add each as an **individual grey CNAME**
  in Cloudflare **and** as a domain in the Vercel project.
  ⚠️ **Wildcard `*.crechewise.com` is unreliable on Cloudflare Registrar** (NS lock →
  525 on Skool Bido). Do per-subdomain individually, or use the path-based form.

## 6. Smoke test (after DNS resolves)
- `https://crechewise.com` → Creche Wise carousel landing.
- Sign in as an admin → dashboard loads; **Import**, **Fees & Invoices**, **Ratios**,
  **Daily Check-in**, **Arrears** all render.
- A test crèche portal loads its branded hero.
- ⚠️ **Remove `src/app/api/dev/` before this deploy** (dev-only seed route).
- Run `node scripts/verify-tenant-isolation.mjs` against the deployed DB.
