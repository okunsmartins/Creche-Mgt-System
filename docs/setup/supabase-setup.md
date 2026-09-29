# Supabase Setup — Crèche Platform (fresh project)

**Date:** 2026-09-17
**Goal:** stand up a NEW Supabase project for the crèche fork, apply all migrations (001–070), wire `.env.local`, and run the app locally.

> ⚠️ **Do NOT reuse the school production project** (`jywkpenzhzzptsrntobf` "PrimarySchoolPortal"). This is a separate product with its own data. Create a brand-new project.

---

## A. Create the Supabase project (web UI)
1. Go to https://supabase.com/dashboard → **New project**.
2. Name: `Creche Mgt Sys` (or similar). Org: your own.
3. **Region:** an EU region (e.g. West EU / Ireland / Frankfurt) for data residency.
4. Set a **strong database password** and save it in your password manager.
5. Create, wait ~2 min for provisioning.

## B. Grab the API keys
Project → **Settings → API**. Copy these three (used in step D):
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## C. Apply the schema (one shot)
This repo has no Supabase CLI config, so use the SQL editor with the regenerated combined file.
1. Project → **SQL Editor → New query**.
2. Open `supabase/all_migrations_combined.sql` (69 migrations, 001–070, freshly regenerated), copy **all** of it, paste, **Run**.
3. Verify success: **Table Editor** should now list `schools`, `students`, `teachers`, `classes`, `orders`, `payments`, `tenant_funding_settings`, `funding_scheme_versions`, `custom_field_definitions`, etc.
4. Quick sanity check — run in SQL editor:
   ```sql
   select table_name from information_schema.tables
   where table_schema='public' order by 1;
   ```
   (Expect ~45 tables.)

> If you later add a migration (e.g. FEE-01), either run just that new file in the SQL editor, or regenerate the combined file (see §G).

## D. Configure `.env.local`
1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Fill the **required-to-run** values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL=` → Project URL (step B)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` → anon key
   - `SUPABASE_SERVICE_ROLE_KEY=` → service_role key
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `PLATFORM_OWNER_EMAIL=martins.okuonghae@gmail.com`  ← designates the platform owner
   - `ENCRYPTION_KEY=` → generate one:
     ```bash
     openssl rand -base64 32
     ```
   - `CRON_SECRET=` → generate another:
     ```bash
     openssl rand -base64 24
     ```
   - `NODE_ENV=development` and `APP_ENV=poc`
3. **Placeholders** for integrations not configured yet (env is read lazily, but set dummy values so a page that touches them doesn't crash before you wire Stripe/Resend/Twilio):
   - `STRIPE_SECRET_KEY=sk_test_placeholder`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder`
   - `STRIPE_WEBHOOK_SECRET=whsec_placeholder`
   - `RESEND_API_KEY=re_placeholder`
   - `EMAIL_FROM_ADDRESS=noreply@example.ie`
   - `EMAIL_FROM_NAME=Crèche Portal`
   - `SCHOOL_NOTIFICATION_EMAIL=martins.okuonghae@gmail.com`
   - Leave Twilio / Revolut / Stripe price IDs blank until those features are configured.
4. Leave `NEXT_PUBLIC_SCHOOL_ID` **blank** (multi-tenant resolves by subdomain/path — there is deliberately no default tenant).

## E. Auth URL config (so email links work)
Project → **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/**`

## F. Run it
```bash
npm ci
```
```bash
npm run dev
```
Open http://localhost:3000. Create the owner account (the email must match `PLATFORM_OWNER_EMAIL` to get platform-owner access), then walk the tenant onboarding to create the first crèche.

## G. Adding future migrations
After we add a migration file under `supabase/migrations/`, regenerate the combined file and run the new one:
```bash
python -c "import glob,os; open('supabase/all_migrations_combined.sql','w',encoding='utf-8').write('\n\n'.join('-- '+os.path.basename(m)+'\n'+open(m,encoding='utf-8').read() for m in sorted(glob.glob('supabase/migrations/*.sql'))))"
```
For a live project, run only the **new** migration file in the SQL editor (don't re-run the whole combined file over existing data).

---

## Notes
- **Storage buckets:** none required for first boot (no `storage.from()` usage in app code). If a document/logo upload errors later, create the referenced bucket then.
- **Grants/RLS:** all included in the migrations (this project has no default privileges — every table has explicit `service_role`/`authenticated` grants).
- **Seed:** `supabase/seed.sql` is from the school project and may contain school-specific rows — review before running; not required to boot.
