# Crèche Platform — Implementation Status

> **Supersedes** the inherited Skool Bido / Scoil Bhríde status log (this repo is a fork per
> [adr/ADR-001-fork-existing-stack.md](adr/ADR-001-fork-existing-stack.md)). Governing spec: the
> Crèche Management Platform Master Specification. Design: [design/fee-subvention-engine.md](design/fee-subvention-engine.md),
> [design/reuse-map.md](design/reuse-map.md). Tickets: [backlog/p3-fee-subvention-tickets.md](backlog/p3-fee-subvention-tickets.md).

**Project:** Creche Wise — Crèche Management Platform (First Stack Solutions)
**Last updated:** 2026-09-29
**Honesty rule:** ✅ = built **and** verified (automated test, or an explicitly-noted manual/DB verification).
🟡 = built but **not fully verified** (no end-to-end/automated test yet — do **not** report as done).
🔵 = inherited from the fork, reusable but **not** crèche-complete. ⬜ = not started.

---

## Verification snapshot (2026-09-29)

| Check | Command | Result |
|---|---|---|
| Unit/integration tests | `npm run test -- run` (`vitest run`) | ✅ **762 passed / 59 files** |
| Type-check | `npm run type-check` (`tsc --noEmit`) | ✅ exit 0, clean |
| Lint | `npm run lint` (`eslint src`) | ✅ exit 0, clean |
| DB migrations 068–072 applied | verified via service-role script | ✅ tables/grants/RPC/guard-trigger + DOB column & backfill present |
| Manual browser E2E (import, hero, fees UI, nav) | dev server + manager sign-in | ✅ see per-feature notes |
| Tenant isolation + idempotency (fee tables) | `node scripts/verify-tenant-isolation.mjs` | ✅ **10/10** (scoping, RLS deny-by-default, dup invoice-number rejected) |
| E2E (Playwright) | `npm run test:e2e` | ⬜ **not run** (needs running app + env) |
| Secret scanning + push protection (GitHub) | repo Settings | ✅ **active** (blocked a Twilio SID push; SID redacted from history) |
| Security scans (SAST/SCA/DAST/SBOM) | — | ⬜ **not set up** (spec §11.4) |

**Crèche-specific automated tests (96 of the 762):** subvention 18, funding-config 13, custom-fields 18, age 9,
ratio 6, fee-schedule 8, invoice-generation 8 + 4 property/edge, import 12. Plus a DB-backed
isolation/idempotency script (`scripts/verify-tenant-isolation.mjs`, run manually — CI has no DB).

**Git:** remote `origin` = `github.com/okunsmartins/Creche-Mgt-System`. All work is committed and pushed;
`main` has PRs #1 (crèche build), #2 (Prettier/CI fix), #3 (isolation tests + branch-protection checklist) merged.
**CI** (`.github/workflows/ci.yml`) runs Lint & Type Check (type-check + lint + `format:check`), Unit Tests, Production
Build on every PR; E2E job defined but not passing yet. ⚠️ **No branch protection** — PRs #1 and #3 merged before/while
CI ran, so red or unchecked merges are currently possible (see `docs/setup/github-branch-protection.md`).

**Database:** Supabase project `xpbavfutfejlfbmnntyl` (the crèche dev project — NOT the school prod DB).
Migrations 001–071 applied. Test tenant: **Angels Nest Crèche** (`manager@angelsnest.ie`; password in the
gitignored `creche-dev-credentials.local.txt`). Note: the DB currently holds **2 schools** rows (a default +
Angels Nest) — scope every query by `school_id`.

---

## ✅ Completed & verified (crèche-specific)

### FEE-05 — ECCE + NCS subvention engine
- **Files:** `src/lib/payments/subvention.ts` (+ tests). **18 tests.**
- Pure netting: gross − ECCE (zero-rated, ≤3h/day, ≤15h/wk, term-time) − NCS (hourly, capped, never below zero)
  = parent net; plus provider Pobal receivables. Integer cents; ECCE→NCS→discount ordering; exact period sums.
- **⚠️ Rate constants are 2025/26 reference values flagged `CONFIRM`** — must be confirmed with a Pobal/finance SME.

### FEE-03 — Funding config (code + migration applied)
- **Files:** `src/lib/payments/funding-config.ts` (+ tests); migration `068_funding_config.sql`. **13 tests.**
- Migration **applied & verified** (`funding_scheme_versions` seeded with 2 reference rows; `tenant_funding_settings` present).
- **Not done:** tenant settings **UI**; `term_calendar_id` not modelled.

### CF-01 — Custom fields data layer
- **Files:** `src/lib/custom-fields/schema.ts` (+ tests); migration `070_custom_fields.sql`. **18 tests.**
- Migration **applied & verified** (`custom_field_definitions` + `custom_fields` JSONB on students/profiles/teachers/classes).
- Pure logic: per-type validation, slug, sensitive-key blocking, promotion type-contract.
- **Not done:** CF-02 form renderer, CF-03 import "create/map field", CF-04 promotion engine, CF-05 materialise.

### Room ratio engine (spec §7.4/7.5)
- **Files:** `src/lib/ratios/ratio.ts` (+ tests). **6 tests.** Required-staff/shortfall/spare-capacity/severity;
  reference Irish age-band ratios flagged **CONFIRM**. **Engine only — no UI, no live room counts.**

### Fee-schedule generator (spec §8.5)
- **Files:** `src/lib/fees/schedule.ts` (+ tests). **8 tests.** Dated obligations weekly/fortnightly/monthly/annually,
  month-end clamp. Pure. (No "term" frequency yet — spec lists it.)

### Invoice-generation engine (FEE-06 core)
- **Files:** `src/lib/fees/invoice.ts` (+ tests). **8 tests.** Weekly subvention grouped into billing periods;
  flat + hourly; ECCE zero-rate; NCS netting; term-calendar filter. Pure.

### Guided import wizard (spec §5.4) — the validated wedge
- **Files:** `src/lib/import/*` (parse/validate/fields/actions, **12 tests**), `src/components/import/ImportWizard.tsx`,
  `src/app/(admin)/admin/import/page.tsx` (Pro-gated).
- CSV + XLSX (SheetJS), auto-mapping, live preview, per-row validation, **downloadable error report**, Children **and** Staff datasets.
- **✅ Manually verified end-to-end in the browser** (as `manager@angelsnest.ie`): imported children incl. the previously-failing
  ambiguous DOB (Saoirse Kelly, `02/11/2022`), duplicates skipped, staff imported, error report downloaded with reasons.
  **No automated E2E** — lib is unit-tested; the wizard flow is manually verified.

### Migrations 068–071 applied & verified
- `068` funding config, `069` onboarding settings, `070` custom fields, `071` fees/invoices — all present in the DB.
- **071 verified via script:** table writes, the **partial-unique "one ACTIVE funding per scheme per child"**, the
  `generate_invoice_number` RPC, and the **immutability guard trigger** (an issued invoice's financial fields cannot be edited).

### Branding (Creche Wise) — verified in browser (no automated test)
- Platform renamed **Skool Bido/"Crèche Management System" → "Creche Wise"** (`crechewise.com`); `PLATFORM_NAME` constant
  (`src/lib/platform/brand.ts`); email from-name + metadata updated.
- **Home hero split:** Creche Wise platform landing → **5-slide carousel** (`src/components/marketing/HeroCarousel.tsx`);
  a signed-up crèche's portal → **static hero branded to its name** ("Welcome to {crèche}"). Both verified in-browser.

### Domain rename — user-facing copy (verified in browser)
- Sidebar, list pages, dashboard, **add/edit forms**, page titles/breadcrumbs, home **features grid**,
  onboarding, permission-slip labels, **Crèche Settings**, and platform-owner views all use
  **Children / Staff / Rooms / crèche**. ~200 strings across ~80 files; bulk prose sweep for
  "your/the/a school" → crèche, "by/per class" → room, "roll call" → register, "report card" → development report.
- ⚠️ Routes, DB tables and code identifiers are **unchanged** by design (`/admin/students`, `students`, `classes`, `teachers`).
- Remaining school wording, if any, is incidental prose — grep `-i "school"` before go-live for a final pass.

### DOB → real column + NCS age eligibility (migration 072, verified)
- `students.date_of_birth` column + backfill (5/5 existing children); index. Import writes the column.
- `src/lib/age/age.ts` — pure age helpers + `ncsAgeEligibility` (**age gate only**, not means-testing) — **9 tests**.
- Child billing page shows **DOB · age · NCS age-eligible** (verified in-browser). Reference 24wk–15y, flagged CONFIRM.

---

## 🟡 Built but NOT fully verified — do NOT report as complete

| Item | Files | What's verified | What's NOT verified (gap to close) |
|---|---|---|---|
| **FEE-01** fee schedules (partial) | `fee_schedules` table (mig 071); `createFeeScheduleAction` | table applied; a row inserts via service-role script | **No `service_rates` table, no effective-dated rates, no overlap rejection, no "term" frequency.** Server action never exercised via UI; no automated test. |
| **FEE-02** child funding registrations | `child_funding_registrations` (mig 071); `upsertFundingRegistrationAction` | table applied; partial-unique + PPSN encrypt used; verified via script | **No automated test** for the constraint, encryption round-trip, or "PPSN never in logs". Action not integration-tested. |
| **FEE-04** invoice ledger (partial) | `invoices` (mig 071) + guard trigger | table + guard trigger verified via script | **State machine simplified** vs spec (`draft/issued/paid/part_paid/void` vs spec's 8 states); **no `invoice_lines` table**; not integration-tested. |
| **FEE-06** generation action | `generateInvoicesForScheduleAction` | engine 8 + 4 property tests; DB write path script-verified; **isolation + idempotency verified** via `scripts/verify-tenant-isolation.mjs` | Server action still **not exercised via authenticated UI**; isolation check is a manual script, not a CI job. |
| Invoice **issue/void** lifecycle | `issue/voidInvoicesForScheduleAction` + buttons | actions built; guard trigger verified | Not integration-tested via UI. |
| **FEE-07** parent invoice view | `/parent/invoices/page.tsx` | route compiles; auth guard redirects (HTTP 307) | **No data-render test** (needs a parent account linked to a child with issued invoices); **no parent-authz / a11y test**. |
| Admin fees UI | `/admin/fees`, `ChildBillingPanel.tsx` | renders; lists children; forms display | **End-to-end create→generate→issue not completed via UI** (browser date-picker automation blocked; the flow itself is untested end-to-end). |

---

## 🔵 Inherited from the fork — reusable, NOT crèche-complete

Work for the **school** product; passes its own tests but **not verified for the crèche**. Do not report as done.

| Area | Where | Status for crèche |
|---|---|---|
| Multi-tenant core, Auth/RBAC, RLS + grants | `lib/tenant/*`, `lib/auth/*`; migs 003/004/009–021/033–036 | 🔵 reuse; new tables need own grants + RLS |
| Stripe Connect (per-tenant) / Revolut / Twilio SMS / Resend email | `lib/stripe|revolut|sms|email/*`; migs 055–057/066/067 | 🔵 code complete; need KYC/ComReg/domain activation + fee wiring |
| Orders, payment-links, refunds, reconciliation, subscriptions, documents, crypto | `lib/*` | 🔵 reuse; adapt to crèche fee flows |
| Attendance (per class session) | `lib/attendance/*`; migs 031/032/062 | 🔵 base reusable; reshape to daily check-in + ratios |
| Instalment math | `lib/payments/instalments.ts`; mig 023 | 🔵 math reusable; **rules diverge — see FEE-09** |

---

## ⬜ Outstanding (not started)

**Fee/subvention:** FEE-08 pay invoice via Connect (needs KYC), FEE-09 instalment reshape (`>€20`, configurable 2/3/4),
FEE-10 arrears reminders + dashboard, FEE-11 attendance true-up + Pobal claim accrual ledger. Also: `service_rates`
(FEE-01), `invoice_lines` + full state machine (FEE-04), parent invoice **payment** wiring.

**P0 crèche scope (spec):** ratio **UI** (live counts using the tested ratio engine);
NCS/ECCE Hive-prep reports + absence alerts (§7.7, no Hive API); enquiry/waiting-list CRM (§7.3); daily records
(sleep/nappy/meal/incident/medication) (§7.6); compliance centre + inspection exports + retention (§7.7);
commercial dashboard (occupancy, revenue by room) (§7.8).

**DevSecOps (spec §11):**
- ✅ GitHub remote + PR CI (lint/type/format/unit/build); ✅ secret scanning + push protection active.
- ⬜ **Branch protection** on `main` (required checks, no bypass) — checklist ready in `docs/setup/github-branch-protection.md`.
- ⬜ Wire `scripts/verify-tenant-isolation.mjs` into a DB-enabled CI job; get the E2E job actually passing.
- ⬜ SAST/Semgrep, SCA/Dependabot updates, Trivy, DAST/ZAP, SBOM; DPIA + threat-model sign-off (children's special-category data).

---

## Manual configuration steps

1. **Deps:** `npm ci` (Windows: slow first run, ~10 min — normal).
2. **`.env.local`** is present and filled for the dev Supabase (`xpbavfutfejlfbmnntyl`) + `ENCRYPTION_KEY` + `CRON_SECRET`;
   Stripe/Resend/Twilio are placeholders. Never commit (gitignored).
3. **Applying future migrations:** no `SUPABASE_DB_URL`/psql/management token is configured here, so DDL is applied by
   **pasting the migration into the Supabase SQL editor** (that is how 068–071 were applied). To automate later, set a
   connection string and use `npm run db:migrate` (`supabase db push`).
4. **Confirm NCS/ECCE rates** with a Pobal/finance SME and load into FEE-03 config; replace the `CONFIRM` fallbacks.
5. **Confirm the reference Irish room ratios** in `src/lib/ratios/ratio.ts` (flagged CONFIRM) before any ratio UI ships.
6. **⚠️ Remove `src/app/api/dev/` before production** (dev-only seed/Pro-unlock route).
7. **Enable branch protection on `main`** now (repo exists + CI runs): `docs/setup/github-branch-protection.md`.
8. **Before pilot / go-live:** Stripe Connect + Revolut KYC; ComReg/Twilio A2P;
   email sender-domain (SPF/DKIM/DMARC); DPIA. See [backlog/day-0-action-pack.md](backlog/day-0-action-pack.md).

---

## Security considerations (spec §10 + fork lessons)

- **Service-role bypasses RLS** — every admin-client query must include its own `school_id` filter (RLS is a second boundary,
  not the only one). The DB has **2 schools**, so cross-tenant leakage is testable right now.
- **New tenant-owned tables need their own grants + RLS + a cross-tenant negative test in the same PR** (release-blocking).
  `fee_schedules`/`invoices`/`child_funding_registrations` have grants + RLS, and **isolation is verified** by
  `scripts/verify-tenant-isolation.mjs` (app-layer scoping + RLS deny-by-default; run manually against a DB, not in CI).
  Wiring this into a DB-enabled CI job is still outstanding.
- **`child_funding_registrations` holds PPSN (special-category)** — stored encrypted (`src/lib/crypto`), **not granted to
  `authenticated`** (service-role only). Add an automated "PPSN never in logs/telemetry" test (currently missing).
- Invoices are **immutable once issued** (DB guard trigger verified); financial changes are reversed by **voiding**, not editing.
- No sequential public IDs; invoice numbers via race-safe `generate_invoice_number` RPC.
- Never log secrets, card data, health/allergy details, or full payment/message payloads.

---

## Exact commands to continue

```bash
# repo root: E:\First Stack Solutions\Creche_Mgt_System
npm ci                          # install deps (first time)
npm run test -- run             # full vitest suite (749 tests)
npm run type-check              # tsc --noEmit
npm run lint                    # eslint src
npm run test:e2e                # Playwright (needs app running + env) — not yet run

# run the app (this session used a background dev server on :3000)
npm run dev                     # http://localhost:3000  (first compile ~55s on Windows)

# run one crèche suite
npm run test -- run src/lib/fees/__tests__/invoice.test.ts
npm run test -- run src/lib/payments/__tests__/subvention.test.ts

# tenant isolation + idempotency (needs .env.local with the dev DB)
node scripts/verify-tenant-isolation.mjs

# git — remote is set; work on a branch and open a PR
git checkout -b feat/<name>
git add -A && git commit -m "..."
git push -u origin feat/<name>   # then open the PR on GitHub
```

**Recommended next:**
1. **Enable branch protection** on `main` (checklist in `docs/setup/github-branch-protection.md`) so red PRs stop merging.
2. **Unblock FEE-08:** onboard a test-mode Stripe Connect account (manager → Payment Setup), then wire + verify invoice payment in sandbox.
3. Finish the **domain rename** (forms/reports/features grid) and **promote DOB** to a real column (NCS age eligibility, migration 072).
