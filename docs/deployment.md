# Deployment Guide

## Local development setup

### Prerequisites
- Node.js 20+
- npm 10+
- Supabase CLI (`npm install -g supabase`)
- Stripe CLI (`stripe` — for local webhook forwarding)

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd "Primary Management System"

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# 4. Apply database migrations
supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"
# OR via Supabase Dashboard → SQL Editor → run each migration in order (001–010)

# 5. Apply seed data
# Run supabase/seed.sql in the SQL Editor

# 6. Create super administrator (see below)

# 7. Start the development server
npm run dev
# Open http://localhost:3000
```

### Creating the super administrator

**Never commit credentials.** Create the admin account using one of these methods:

**Option A — Supabase Dashboard:**
1. Authentication → Users → Invite user
2. Use email: `admin@yourdomain.ie`
3. User receives invite email, sets password
4. In SQL Editor, run:
```sql
INSERT INTO public.user_roles (user_id, role_id, school_id, granted_by)
SELECT
  '<paste-auth-user-uuid-here>',
  r.id,
  '00000000-0000-0000-0000-000000000001',
  '<paste-auth-user-uuid-here>'
FROM public.roles r
WHERE r.name = 'super_admin';
```

**Option B — Supabase CLI:**
```bash
supabase auth create-user --email admin@yourdomain.ie
```

### Local webhook forwarding (Stripe)

```bash
# Terminal 1 — run Next.js
npm run dev

# Terminal 2 — forward Stripe webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret printed and add to .env.local as STRIPE_WEBHOOK_SECRET
```

---

## Production deployment (Vercel + Supabase)

### 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Select region: **Ireland (eu-west-1)** for GDPR
3. Note the project URL and API keys

### 2. Apply migrations and seed

```bash
# Using Supabase CLI
supabase link --project-ref <project-ref>
supabase db push
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_APP_URL=https://payments.scoilbhride.ie
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=payments@yourdomain.ie   # MUST be on a Resend-verified domain
EMAIL_FROM_NAME=School Payment Portal
SCHOOL_NOTIFICATION_EMAIL=office@yourdomain.ie   # fallback only (see note below)
NODE_ENV=production
```

> **Multi-tenant note (school notification recipient).** The school copy of each
> payment receipt is routed **per tenant**: it goes to the email of the paying
> school's **owner/first admin** (resolved from `user_roles` for that school).
> `SCHOOL_NOTIFICATION_EMAIL` is now only the **fallback** used when a school has no
> resolvable admin. It must still be a real, monitored address.
>
> **Delivery requires a verified Resend domain.** `EMAIL_FROM_ADDRESS` must be on a
> domain you have verified in Resend, or *every* send fails (recorded as `failed` in
> `email_notifications` with `failure_details = "... domain is not verified"`). Email
> failure never affects payment state — it is logged and retryable from the admin
> order page.

### 4. Configure Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://payments.scoilbhride.ie/api/webhooks/stripe`
3. Events to listen for:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `refund.updated`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

### 5. Configure Resend

1. [resend.com](https://resend.com) → Add domain → `scoilbhride.ie`
2. Add DNS records as instructed
3. Create API key → set as `RESEND_API_KEY` in Vercel
4. Set `EMAIL_FROM_ADDRESS=payments@scoilbhride.ie`

### 6. DNS setup

Add CNAME at your DNS provider:
```
payments.scoilbhride.ie  CNAME  cname.vercel-dns.com
```

Add to Vercel Project → Domains → `payments.scoilbhride.ie`

### 7. School website link

On the existing school website, add a "Make a Payment" link:
```html
<a href="https://payments.scoilbhride.ie" target="_blank" rel="noopener">
  Make a Payment
</a>
```

---

## Rollback

```bash
# Revert to previous Vercel deployment
vercel rollback

# Database rollback — migrations are forward-only in the POC
# To revert: apply reversal SQL manually (not automated)
```

## Backup and recovery

- **Database**: Enable Supabase automatic daily backups (Dashboard → Settings → Backups)
- **Code**: GitHub repository is the source of truth
- **Stripe data**: Stripe retains all payment records independently
- **Recovery time objective (production)**: < 4 hours for full restore

## Environment variable reference

| Variable | Required | Where |
|----------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Yes | Both |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Both |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Both |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only |
| `STRIPE_SECRET_KEY` | Yes | Server only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Both |
| `STRIPE_WEBHOOK_SECRET` | Yes | Server only |
| `RESEND_API_KEY` | Yes | Server only |
| `EMAIL_FROM_ADDRESS` | Yes | Server only |
| `EMAIL_FROM_NAME` | No | Server only |
| `SCHOOL_NOTIFICATION_EMAIL` | Yes | Server only |
| `CRON_SECRET` | No | Server only |
| `NODE_ENV` | Auto | Vercel sets this |
