# Crèche Platform — Implementation Status

> **Supersedes** the inherited Skool Bido / Scoil Bhríde status log (this repo is a fork per
> [adr/ADR-001-fork-existing-stack.md](adr/ADR-001-fork-existing-stack.md)). Governing spec: the
> Crèche Management Platform Master Specification. Design: [design/fee-subvention-engine.md](design/fee-subvention-engine.md),
> [design/reuse-map.md](design/reuse-map.md). Tickets: [backlog/p3-fee-subvention-tickets.md](backlog/p3-fee-subvention-tickets.md).

**Project:** Creche Wise — Crèche Management Platform (First Stack Solutions)
**Last updated:** 2026-10-07
**Also governed by:** the _Early Years Hive & Funding Automation — Claude Code Implementation Addendum_ for the
Funding & Hive Centre (Phases 1–4). Phase-0 impact map: [design/hive-funding-centre-impact-assessment.md](design/hive-funding-centre-impact-assessment.md).
See the dedicated section **"Funding & Hive Centre — Phases 1–4"** below.
**Honesty rule:** ✅ = built **and** verified (automated test, or an explicitly-noted manual/DB verification).
🟡 = built but **not fully verified** (no end-to-end/automated test yet — do **not** report as done).
🔵 = inherited from the fork, reusable but **not** crèche-complete. ⬜ = not started.

---

## Verification snapshot (2026-10-06)

| Check | Command | Result |
|---|---|---|
| Unit/integration tests | `npm run test -- run` (`vitest run`) | ✅ **897 passed / 78 files** (re-run 2026-10-06, exit 0) |
| Type-check | `npm run type-check` (`tsc --noEmit`) | ✅ exit 0, clean (2026-10-06) |
| Lint | `npm run lint` (`eslint src`) | ✅ exit 0, clean (2026-10-06) |
| Format | `npm run format:check` (`prettier --check`) | ✅ all files match (funding + teachers re-checked 2026-10-06) |
| DB migrations 068–088 applied | verified via service-role scripts / Supabase SQL editor | ✅ incl. **084–088** Funding & Hive Centre (Phases 1–5, 088 = AIM); user-applied, "Success" |
| Manual browser E2E (import, hero, fees UI, nav, check-in→ratios, arrears) | dev server + manager sign-in | ✅ see per-feature notes |
| Tenant isolation + idempotency (fee + collection + **all** funding tables) | `node scripts/verify-tenant-isolation.mjs` | ✅ **ALL CHECKS PASSED** (re-run after mig 088): scoping/action-guard/anon-RLS/dup-reject across fee, collection, and all six funding tables incl. `ncs_claim_versions`, `funding_readiness_items`, `core_funding_snapshots`, `aim_cases` |
| Anon-key read sweep (all tenant tables) | service-role/anon script | ✅ no table returns rows to the anon key (after migs 074/075) |
| E2E (Playwright) | `npm run test:e2e` | ⬜ **not run** (needs running app + env) |
| Secret scanning + push protection (GitHub) | repo Settings | ✅ **active** (blocked a Twilio SID push; SID redacted from history) |
| Security scans (SAST/SCA/DAST/SBOM) | — | ⬜ **not set up** (spec §11.4) |

**Crèche-specific automated tests (of the 810):** subvention 18, funding-config 13, custom-fields 18,
age 9, ratio 9, import 12, and the `fees/` suite 44 (invoice 8 + property 2, schedule 8, instalments 8,
projection 4, arrears 5, reminders 5, receivables 4) plus check-in 5, daily-records 5, enquiries 4,
commercial dashboard 5. A DB-backed isolation/idempotency script (`scripts/verify-tenant-isolation.mjs`)
is run manually — CI has no DB.

**Git:** remote `origin` = `github.com/okunsmartins/Creche-Mgt-System`. All work is committed and pushed; every
session feature landed on `main` via PR (build, Prettier/CI fix, isolation tests, DOB/age, check-in+ratio UI,
daily records, enquiries CRM, arrears, reminders, subvention report, commercial dashboard, security lock-downs).
**CI** (`.github/workflows/ci.yml`) runs Lint & Type Check (type-check + lint + `format:check`), Unit Tests,
Production Build on every PR; E2E job defined but **skipped** (not passing yet). ✅ **Branch protection ENABLED** on
`main` (2026-09-30, ruleset "protect-main": PR required + 3 status checks [Lint & Type Check / Unit Tests / Production
Build] + up-to-date + conversation resolution; direct pushes rejected). Phases 1–4 + the teacher-edit fix (PR #43) all
merged green through this gate.

**Database:** Supabase project `xpbavfutfejlfbmnntyl` (the crèche dev project — NOT the school prod DB).
Migrations 001–088 applied (**081 collection register; 082 SMS allowance; 083 child observations; 084–088 Funding &
Hive Centre Phases 1–5** — all applied + DB-verified; 087 `core_funding_snapshots` confirmed by a browser-E2E write;
088 `aim_cases` confirmed by the re-run isolation script passing). Test tenant: **Angels Nest Crèche**
(`manager@angelsnest.ie`; password in the
gitignored `creche-dev-credentials.local.txt`). Note: the DB holds **2 schools** rows (a default + Angels Nest)
— scope every query by `school_id`.

---

## Staff Workforce module — Phases 1–5 (rosters, timesheets, cover, payroll, vetting)

> Built 2026-10-06/07 from the master spec "staff section" request: rosters/shift planning,
> timesheets, ratio & cover alerts, payroll export, and Garda vetting renewal. Pure-logic-first
> + vitest; each phase its own branch/PR off `main`. All gates green on each branch
> (`tsc --noEmit` clean on source; `eslint` clean; `prettier --check` clean; full suite **944 passed / 85 files**).

| Phase | What | Key files | Migration | Status |
|---|---|---|---|---|
| **1 — Weekly rota** | Shift planner per staff/room/day; overlap + time validation; week nav | `lib/rota/rota.ts` (8 tests), `rota/queries.ts`, `rota/actions.ts`, `RotaBoard.tsx`, `/admin/rota` | **092** `staff_shifts` ✅ applied | ✅ merged **PR #55**, browser-E2E |
| **2 — Timesheets** | Seed PENDING from the week's shifts (actual=planned, idempotent), edit actual hours, approve/reopen; weekly hours by staff | `rota/timesheets.ts` (5 tests), `timesheet-actions.ts`, `timesheet-queries.ts`, `TimesheetBoard.tsx`, `/admin/timesheets` | **093** `staff_timesheets` ✅ applied | ✅ merged **PR #56**, browser-E2E (generate → approve) |
| **3 — Ratio & cover alerts** | Per-room required-vs-rostered staff per day (uses `roomStaffingRequirement` + child DOBs); flags room-days under ratio | `rota/cover.ts` (2 tests), `cover-queries.ts`, `CoverAlertsPanel.tsx` (on `/admin/rota`) | none (reads shifts + children) | 🟡 PR **open** `feat/staff-cover-alerts`, browser-E2E done |
| **4 — Payroll export** | Per-staff APPROVED timesheet hours for a pay period; preview table + CSV download for payroll providers | `rota/payroll.ts` (3 tests), `payroll-queries.ts`, `/api/admin/staff/payroll` (CSV), `/admin/payroll` | none (reuses 093) | 🟡 PR **open** `feat/staff-payroll`, browser-E2E (seed approved → preview + CSV 200) |
| **5 — Garda vetting renewal** | Per-staff NVB disclosure + renewal date; status (valid / renewal-due ≤60d / expired / no-date / not-recorded); attention banner; inline record/edit/clear | `lib/vetting/vetting.ts` (9 tests), `vetting/queries.ts`, `vetting/actions.ts`, `VettingBoard.tsx`, `/admin/vetting` | **094** `garda_vetting` ⬜ **PENDING** | 🟡 PR **open** `feat/staff-garda-vetting`; **read path** browser-verified (renders + migration banner pre-migration); **write path NOT verified** (needs 094) |

**Outstanding / to continue:**
- **Apply migration 094** (`supabase/migrations/094_staff_garda_vetting.sql`) to the real project
  `xpbavfutfejlfbmnntyl` in the Supabase SQL editor. Until then `/admin/vetting` shows a
  "not active yet" banner and saving no-ops (by design — the query tolerates the absent table).
- **Open + merge the 4 open PRs** (#55 and #56 already merged). Merge order matters: all four touch
  `AdminSidebar.tsx` (STAFF nav). Merge one, then **re-sync each other branch** with `main`
  (the app's `sync_with_base_branch`, or `git merge main`) before merging the next — otherwise the
  branch-up-to-date CI rule blocks them and the nav array conflicts.
- After 094 is applied: verify the vetting **write path** (record a disclosure for a staff member →
  status flips to Valid/Renewal-due/Expired; Clear removes it).

**Security / tenancy:** every query/action is `school_id`-scoped through `createSupabaseAdminClient`
(RLS bypassed → manual scoping); vetting upsert/delete and timesheet approval use verify-then-write
(`.eq('id').eq('school_id')`). Migrations 092–094 are RLS-on with explicit grants (SELECT→authenticated,
full→service_role) + `set_updated_at` trigger, matching house convention. CSV cells are all quoted/escaped.

**Commands to continue (per branch):**
```bash
npx tsc --noEmit        # source clean; ignore stale .next/types stubs for routes on other branches
npx eslint src
npx prettier --check "src/**/*.{ts,tsx}"
npx vitest run          # 944 passed / 85 files
```

---

## Funding & Hive Centre — Phases 1–5 (Hive & Funding Automation Addendum)

> Additive layer, **feature-flagged per tenant** (`tenant_funding_settings.hive_centre_enabled`, ships **dark**).
> Governing rule: **proactive compliance, not competitor parity**, and **no direct Hive automation** — there is no Hive
> API, so the only "integration" is prepare / validate / export for the human to submit. Migrations **084–088** applied.
> Phase-0 map: [design/hive-funding-centre-impact-assessment.md](design/hive-funding-centre-impact-assessment.md).
> Code: `src/lib/funding/*`, `src/components/funding/*`, `src/app/(admin)/admin/funding/*`,
> `src/app/api/{cron/ncs-weekly-compliance,admin/funding/*}`.

**2026-10-06 review result:** type-check, ESLint, Prettier all clean; **897/78 vitest pass** (of which the funding pure
suites = 47: `week` 5, `ncs-compliance` 16, `copayment` 12, `ecce-readiness` 9, `core-funding` 5). **No reproducible
defects found** in the Phase 1–4 logic reviewed (NCS engine, co-payment, reconciliation, access gate, cron guard,
permission gates). The outstanding items below are **unbuilt features**, not bugs.

### ✅ Completed & verified (automated test + browser E2E on Angels Nest)

| Phase | What | Key files | Verification |
|---|---|---|---|
| **1 — NCS weekly compliance** | Versioned rules (`ncs-2026.1`: 4-wk absence / 8-wk under / 12-wk continued / pre-threshold wk 6–7 / closure-pauses); pure weekly engine (under-attendance, consecutive counters, threshold + risk, ECCE-minute exclusion, term/non-term); immutable weekly snapshots; prioritised **explainable** action queue; weekly-return review pack (printable) + CSV export; Mon-07:00 cron | `rules.ts`, `ncs-compliance.ts`, `week.ts`, `service.ts`, `queries.ts`, `actions.ts`, `FundingDashboard.tsx`, `/admin/funding` + `/ncs-weekly`, `api/cron/ncs-weekly-compliance`, `api/admin/funding/ncs-weekly` (mig 084) | 21 unit tests; browser E2E: 8-wk under-attendance → ACTION with explanation + due date |
| **2 — Claims & co-payment** | Claim status machine (DRAFT⇄READY→VERIFIED→SUBMITTED_EXTERNALLY / SUPERSEDED); co-payment = fee − NCS − ECCE − discount (floored); mandatory-fields from 31 Jul 2026; **3-way billing reconciliation** → deduped mismatch action, **never mutates invoice/claim**; versioned claim snapshots; CSV export | `copayment.ts`, `reconcile.ts`, `claim-actions.ts`, `ClaimsPanel.tsx`, `/admin/funding/claims`, `api/admin/funding/claims` (mig 085) | 12 unit tests; browser E2E: €75.40 co-payment; lifecycle Draft→Submitted; €200 vs €75.40 mismatch action |
| **3 — ECCE + Programme Readiness** | ECCE prep (sessions AM/PM/OTHER, Eircode check, **AIM-Level-7 gate** requiring confirmed session before "ready"); mark prepared/submitted; 2026/2027 readiness checklist (10 items, statuses + due dates) | `ecce.ts`, `readiness.ts`, `ecce-actions.ts`, `EccePanel.tsx`, `ReadinessPanel.tsx`, `/admin/funding/ecce` + `/readiness` (mig 086) | 9 unit tests; browser E2E: AIM-L7 "ready" blocked without session, passes with AM; checklist seeded |
| **4 — Core Funding shadow/drift** | Last **verified** service profile snapshot vs **live** staff/room counts (+ manager-held capacity/weeks); drift detection; "Flag for review" → explainable `CORE_FUNDING_DRIFT` action; immutable snapshots | `core-funding.ts`, `core-funding-actions.ts`, `queries.getCoreFundingView`, `CoreFundingPanel.tsx`, `/admin/funding/core-funding` (mig 087) | 5 unit tests; browser E2E: capture → "Matches current" → add staff → "Drift detected (Staff 3→4)" → flag → queue item |
| **5 — AIM (restricted/sensitive)** | AIM levels 1–7; case status machine (`PREPARING→CONSENT_RECORDED→READY→SUBMITTED_EXTERNALLY`, `CLOSED` terminal); hard **consent gate** + level + support summary before Hive prep; stored data = case fields + **brief non-clinical** summary only (never PPSN/CHICK/health); dedicated audit events; gated behind its own `funding.manage_aim` (stricter `requireFundingAimAdmin`) | `aim.ts`, `aim-actions.ts`, `queries.getAimCases`, `AimPanel.tsx`, `/admin/funding/aim` (mig 088) | 11 unit tests; browser E2E of the **restricted gate**: admin without `manage_aim` → 404 + no AIM link. ⚠️ **write path (create/consent/submit) NOT yet exercised** — needs `manage_aim` granted after the privacy review (see 🟡 below) |

**Cross-cutting, done:** cross-tenant isolation now covers **all six** funding tables (`funding_programme_config`,
`ncs_weekly_compliance_snapshots`, `hive_action_items`, `ncs_claim_versions`, `funding_readiness_items`,
`core_funding_snapshots`, `aim_cases`) in `scripts/verify-tenant-isolation.mjs` — seed + scoping + action-guard + anon-RLS;
**re-ran live against the dev DB after mig 088 → ALL CHECKS PASSED**. Also: `funding.*` permissions seeded (mig 084) with non-sensitive ones mapped to `super_admin`/`school_admin`;
**sensitive perms (`view_sensitive_identifiers`, `manage_aim`, `override_calculation`) ungranted by default**; every page
behind `requireFundingAdmin` (admin + `funding.view` + flag → `notFound()` when off); every mutation/export gated on the
right `funding.*` permission; cron guarded by `CRON_SECRET`; action descriptions carry **no PPSN/CHICK** (names + hours/€ only).

### 🟡 Built but NOT fully verified — do not report as complete

- **AIM write path (Phase 5)**: the restricted gate is verified (404 without `funding.manage_aim`), but creating a case,
  recording consent and submitting have **not** been exercised end-to-end. By design this needs the owner to grant
  `funding.manage_aim` to a role/user **after a privacy review** (migration 088 is applied). Enable + verify the lifecycle
  before reporting AIM as done.
- **Programme-year rule selection**: `resolveNcsRules()` ignores the programme year (single version `ncs-2026.1`);
  `funding_programme_config` exists but the engine does not yet read `rules_version`/deadlines from it.
- **NCS thresholds/rates** (`NCS_RULES_2026`) are flagged **CONFIRM** against the current Pobal/NCS circular before go-live.
- **E2E**: the addendum §17.4 acceptance scenarios are **not** written as Playwright specs; CI's E2E job is skipped.

### ⬜ Outstanding (not started)

- **Proactive event wiring (addendum §9) — PARTIALLY DONE.** ✅ The three operational-mutation paths are now automatic
  via `src/lib/funding/events.ts` (flag-gated, best-effort, tenant-safe, idempotent), wired into the operational actions:
  **attendance** (check-in/out/undo → recompute that child's NCS week), **fee plan / invoices** (create fee schedule,
  generate invoices → re-run co-payment reconciliation vs the latest claim), and **staff/rooms** (teacher create/update,
  class update → re-evaluate Core-Funding drift and auto-raise/auto-resolve the drift action). Verified E2E on localhost:
  deactivating a staff member auto-raised "Core Funding profile has drifted (Staff 4 → 3)" on the dashboard with **no**
  manual flag click; recapturing auto-resolved it. ✅ **Time-based scans now wired** via `src/lib/funding/scans.ts` (pure,
  6 tests) + `scans-service.ts` + the daily `/api/cron/funding-scans` cron (`30 6 * * *`, `CRON_SECRET`-guarded): **NCS
  award/CHICK expiry** (APPROACHING within 30d / EXPIRED → deduped per-child action) and **Programme Readiness drift**
  (MISSING/REVIEW_REQUIRED items overdue or due within 14d → deduped per-item action). Verified E2E on localhost: an
  overdue readiness item → cron raised the action (1), re-run deduped (0), action shown on the dashboard. ⬜ **Still not
  wired:** the service-calendar/closure trigger (needs a calendar/closures model).
- **Immutable submission snapshots / evidence packs** — ✅ BUILT (NCS weekly return) via `submissions.ts` (pure, 5 tests:
  status machine + deterministic canonical payload), migration **089** `funding_submission_snapshots` (immutable payload,
  one live PREPARED per week via partial-unique, RLS + grants), `submission-actions.ts` (prepare = freeze the week's return
  JSON + rules version + preparer, superseding any prior PREPARED; mark-submitted records the external Hive reference),
  `getSubmissionSnapshots`, `/admin/funding/submissions` + `SubmissionsPanel` + dashboard link. Gated: prepare =
  `funding.export`, mark-submitted = `funding.mark_submitted`. ⚠️ **Write path pending migration 089** (page renders + the
  gate is correct; verified in-browser). Rendered PDF export + claims/ECCE snapshot kinds are a follow-up (the table's
  `kind` column is ready for them).
- **Sensitive-identifier controlled reveal + audit — ✅ BUILT (PPSN; CHICK via the same action).** PPSN stays
  presence-only by default; a **controlled reveal** is gated behind `funding.view_sensitive_identifiers` (ungranted by
  default — ships dark, like AIM) and every reveal writes an **audit event** (`funding.ppsn_revealed` /
  `funding.chick_revealed`, recording *which* identifier, never the value). `sensitive-actions.revealIdentifierAction`
  decrypts the PPSN (`decryptSecret`) / returns CHICK, school-scoped; `EccePanel` shows a **Reveal** button only to a
  holder of the permission and displays the value transiently (never persisted). Migration **090** adds the audit enum
  values. ⚠️ Verified in-browser that the gate is dark (a registration with PPSN on file shows **no** Reveal button for an
  admin without the permission). **Full reveal + audit E2E pending** the owner applying migration 090 **and** deliberately
  granting `funding.view_sensitive_identifiers` after a privacy review. CHICK is currently revealable via the same action
  but not yet surfaced in a UI (follow-up).
- **`HiveIntegrationAdapter` interface + `ManualHiveAdapter`** as a named abstraction: not implemented (CSV export is the
  de-facto manual path; formalise before any future Phase 6 import adapter).
- **Child-profile Funding panel/tab**: not built (funding lives only under `/admin/funding/*`).

### Manual configuration steps (funding)

1. **Migrations 084–088** — already applied to prod (`xpbavfutfejlfbmnntyl`). Re-apply by pasting each file into the
   Supabase SQL editor if restoring an environment.
2. **Turn the module on per crèche** (it ships dark):
   `UPDATE public.tenant_funding_settings SET hive_centre_enabled = true WHERE school_id = '<tenant-uuid>';`
3. **`CRON_SECRET`** must be set in Vercel (already in local `.env.local`). The weekly cron is registered in `vercel.json`
   at `0 7 * * 1` (Mon 07:00) → `/api/cron/ncs-weekly-compliance` (Bearer-authenticated).
4. **Grant sensitive permissions deliberately** (left unmapped on purpose) via `role_permissions`:
   `view_sensitive_identifiers`, `override_calculation`, and — to turn on the built AIM module after a **privacy
   review** — `funding.manage_aim`. Until `manage_aim` is granted, `/admin/funding/aim` returns 404 for everyone.
5. **Confirm NCS rules** (`src/lib/funding/rules.ts`, flagged CONFIRM) with a Pobal/NCS SME before enabling for a live crèche.

### Security considerations (funding)

- PPSN stays **encrypted at rest** (`pps_number_encrypted`, `src/lib/crypto`) and is **never revealed** in the funding UI
  (presence boolean only); CHICK is not surfaced. Controlled reveal + audit remain **TODO** before those identifiers are
  ever displayed/exported.
- All funding queries scope by authenticated `school_id` (service-role bypasses RLS); 084–088 tables have RLS + explicit
  grants (SELECT→`authenticated`, full→`service_role`); anon blocked. Cross-tenant isolation for **all six** funding
  tables is now in `scripts/verify-tenant-isolation.mjs` and passes live.
- **AIM is the most restricted domain**: gated behind `funding.manage_aim` (ungranted by default), consent-gated before
  Hive prep, stores only a brief non-clinical summary (never PPSN/CHICK/health), with dedicated `aim.*` audit events.
- Weekly + core snapshots are **immutable** (no `updated_at` trigger) so rule changes never rewrite history.
- Action/notification text must never contain PPSN/CHICK (current descriptions comply).

### Exact commands to continue (funding)

```bash
# repo root: E:\First Stack Solutions\Creche_Mgt_System
npm run test -- run src/lib/funding                 # 47 funding unit tests
npm run type-check && npm run lint && npm run format:check
node scripts/verify-tenant-isolation.mjs           # extend first for claim/readiness/core tables (needs .env.local DB)

# enable the module for the test tenant, then exercise it in the browser
#   SQL: UPDATE public.tenant_funding_settings SET hive_centre_enabled = true WHERE school_id = '<angels-nest-uuid>';
npm run dev                                         # http://localhost:3000/admin/funding  (manager@angelsnest.ie)

# fire the weekly cron locally
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ncs-weekly-compliance

# recommended next build: Phase 5 (AIM) OR event-wiring (§9) — both on a feature branch off main
git checkout -b feat/funding-aim         # or feat/funding-event-wiring
```

**Recommended next for funding** (items 1–3 below are **done** — isolation coverage ✅, §9 event-wiring ✅, AIM built &
gate-verified ✅): (1) **enable AIM** — grant `funding.manage_aim` after a privacy review, then verify the case lifecycle
E2E; (2) the last §9 piece — a service-calendar/closure trigger (needs a calendar/closures model); (3) wire
`funding_programme_config` into `resolveNcsRules`; (4) surface CHICK reveal in the UI + submission PDF/claims/ECCE kinds.
(Done since last revision: award-expiry + readiness-drift scans ✅, child-profile funding panel ✅, submission snapshots ✅
[mig 089 applied, verified], sensitive-identifier PPSN reveal + audit ✅ [mig 090, gate verified; full reveal pending the
permission grant].)

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

### Room ratio engine + UI (spec §7.4/7.5)
- **Engine:** `src/lib/ratios/ratio.ts` (+ tests). **9 tests.** Required-staff/shortfall/spare-capacity/severity,
  age-band grouping; reference Irish age-band ratios flagged **CONFIRM**.
- **UI:** `/admin/ratios` renders live per-room staffing from present-now check-ins + assigned staff.
- **✅ Verified end-to-end in browser** together with check-in: after checking children in, `/admin/ratios`
  reflected live present counts ("2 present of 2 enrolled") against required staff.

### Daily check-in / check-out (spec §7.6 attendance base)
- **Files:** `src/lib/checkin/checkin.ts` (checkInState/isPresentNow/countPresent, **5 tests**), `checkin/actions.ts`
  (checkIn/checkOut/undo), migration `073_daily_check_ins.sql` (applied & verified), `/admin/check-in`.
- **✅ Verified end-to-end in browser** — check-in/out toggles present state and feeds the live ratio view.

### Daily records (spec §7.6)
- **Files:** `src/lib/daily-records/records.ts` (`DAILY_RECORD_TYPES`, `validateDailyRecord` — incident/medication
  require a note; **5 tests**), `daily-records/actions.ts`, migration `076_daily_records.sql` (applied & verified),
  `/admin/daily-records`.
- Engine + data layer tested; migration verified via script (insert/read/CHECK/anon-blocked).
- 🟡 Admin logging UI renders but the create flow is **not** exercised via an automated E2E.

### Enquiry / waiting-list CRM (spec §7.3)
- **Files:** `src/lib/enquiries/enquiries.ts` (`ENQUIRY_STATUSES` 6-stage pipeline, `validateEnquiry`; **4 tests**),
  `enquiries/actions.ts`, migration `077_enquiries.sql` (applied & verified — after an initial "rows=null"
  schema-cache miss showed it hadn't been applied yet), `/admin/enquiries`.
- Engine + data layer tested; migration verified. 🟡 Pipeline UI not E2E-tested.

### Fee-schedule generator (spec §8.5)
- **Files:** `src/lib/fees/schedule.ts` (+ tests). **8 tests.** Dated obligations weekly/fortnightly/monthly/annually,
  month-end clamp. Pure. (No "term" frequency yet — spec lists it.)

### Invoice-generation engine (FEE-06 core)
- **Files:** `src/lib/fees/invoice.ts` (+ tests). **8 tests + 2 property tests.** Weekly subvention grouped into
  billing periods; flat + hourly; ECCE zero-rate; NCS netting; term-calendar filter. Pure.

### FEE-09 — Invoice instalments (engine)
- **Files:** `src/lib/fees/instalments.ts` (+ tests). **8 tests.** Splits an invoice **strictly >€20** into a
  configurable 2/3/4 dated instalments, server-authoritative, exact-sum (remainder on the last). Distinct from the
  inherited school `lib/payments/instalments.ts` (untouched). **Engine only — plugs into FEE-08 once Connect is live.**

### FEE-10 — Arrears summary + reminder selection (engines + dashboards)
- **Files:** `src/lib/fees/arrears.ts` (`summariseArrears`, **5 tests**), `src/lib/fees/reminders.ts`
  (`selectFeeReminders` → due_soon/due_today/overdue, **5 tests**); pages `/admin/arrears`, `/admin/reminders`.
- Pure engines tested (ISO-date lexical comparison, owing-status filtering, per-child rollups).
- **✅ `/admin/arrears` verified in browser** with seeded issued invoices (outstanding/overdue per child rendered).
- 🟡 `/admin/reminders` is a **preview only** — it selects/renders who is due; it does **not** send. Actual
  send wiring (email/SMS) is outstanding and provider-gated.

### Provider receivables / subvention report (spec §7.7)
- **Files:** `src/lib/fees/receivables.ts` (`summariseProviderReceivables`, **4 tests**); `/admin/subvention-report`.
- Sums ECCE + NCS provider receivables per child and overall from issued/part_paid/paid invoices; excludes
  draft/void and private-pay zeros. Engine tested; report page **data-layer verified via script** (no browser E2E).
- ⚠️ This is a **Pobal-prep view**, not a Hive submission (no Hive API — spec-acknowledged).

### Commercial dashboard — occupancy + revenue by room (spec §7.8)
- **Files:** `src/lib/dashboard/commercial.ts` (`occupancyByRoom`, `revenueByRoom`; **5 tests**); `/admin/commercial`.
- Occupancy = children present-now (from check-in) vs enrolled, per room + overall utilisation %. Revenue =
  invoiced/paid/outstanding grouped by the child's room, with an "unassigned" bucket for children with no room.
- Engine tested; page **data-layer verified via script**. 🟡 No browser E2E; "occupancy" uses present-now, **not
  licensed capacity** (capacity isn't modelled yet — noted in the module header).

### FEE-08.5 — Fee-year projection (spec §8.5)
- **Files:** `src/lib/fees/projection.ts` (`summariseFeeYear`; **4 tests**); shown as a card on the child billing page.
- Projects a child's annual parent-net + subvention across the schedule. Pure + tested; card renders in the fees UI.

### Guided import wizard (spec §5.4) — the validated wedge
- **Files:** `src/lib/import/*` (parse/validate/fields/actions, **12 tests**), `src/components/import/ImportWizard.tsx`,
  `src/app/(admin)/admin/import/page.tsx` (Pro-gated).
- CSV + XLSX (SheetJS), auto-mapping, live preview, per-row validation, **downloadable error report**, Children **and** Staff datasets.
- **✅ Manually verified end-to-end in the browser** (as `manager@angelsnest.ie`): imported children incl. the previously-failing
  ambiguous DOB (Saoirse Kelly, `02/11/2022`), duplicates skipped, staff imported, error report downloaded with reasons.
  **No automated E2E** — lib is unit-tested; the wizard flow is manually verified.

### Migrations 068–077 applied & verified
- `068` funding config, `069` onboarding settings, `070` custom fields, `071` fees/invoices, `072` student DOB,
  `073` daily check-ins, `074` secure reference sequences (RLS+revoke), `075` lock down teachers/classes,
  `076` daily records, `077` enquiries — all present in the DB.
- **071 verified via script:** table writes, the **partial-unique "one ACTIVE funding per scheme per child"**, the
  `generate_invoice_number` RPC, and the **immutability guard trigger** (an issued invoice's financial fields cannot be edited).
- **074/075 verified:** an anon-key sweep returns **no rows** from any tenant table after the lock-down (SECURITY
  DEFINER RPCs still work). Resolved the Supabase "Table publicly accessible" linter finding.

### DOB → real column + NCS age eligibility (migration 072, verified)
- `students.date_of_birth` column + backfill (5/5 existing children); index. Import writes the column.
- `src/lib/age/age.ts` — pure age helpers + `ncsAgeEligibility` (**age gate only**, not means-testing) — **9 tests**.
- Child billing page shows **DOB · age · NCS age-eligible** (verified in-browser). Reference 24wk–15y, flagged CONFIRM.

### Branding (Creche Wise) — verified in browser (no automated test)
- Platform renamed **Skool Bido/"Crèche Management System" → "Creche Wise"** (`crechewise.com`); `PLATFORM_NAME` constant
  (`src/lib/platform/brand.ts`); email from-name + metadata updated.
- **Home hero split:** Creche Wise platform landing → **5-slide carousel** (`src/components/marketing/HeroCarousel.tsx`);
  a signed-up crèche's portal → **static hero branded to its name** ("Welcome to {crèche}"). Both verified in-browser.

### Domain rename — user-facing copy (verified in browser)
- Sidebar, list pages, dashboard, **add/edit forms**, page titles/breadcrumbs, home **features grid**,
  onboarding, permission-slip labels, **Crèche Settings**, and platform-owner views all use
  **Children / Staff / Rooms / crèche**. ~200 strings across ~80 files.
- ⚠️ Routes, DB tables and code identifiers are **unchanged** by design (`/admin/students`, `students`, `classes`, `teachers`).
- Remaining school wording, if any, is incidental prose — grep `-i "school"` before go-live for a final pass.

### Authorised Collectors (Feature B) — migration 078, verified
- **Design:** [design/school-collection-and-authorised-collectors.md](design/school-collection-and-authorised-collectors.md).
  Per-child register of approved collectors with crèche approval — a Tusla requirement and the foundation for the
  School Collection Service (Feature A).
- **Files:** `src/lib/collectors/{collectors.ts, password.ts, actions.ts}` (**15 tests**); `/admin/collectors` +
  `CollectorsPanel`; `/parent/collectors` + `ParentCollectorsForm`; sidebar + parent nav links.
- **Verified:** migration 078 applied + DB-checked (insert / CHECK / partial-unique / trigger / anon-blocked);
  **admin flow browser-tested** (add → Approved → Revoke → Approve); **cross-tenant isolation test passing**
  (`scripts/verify-tenant-isolation.mjs` now covers `authorised_collectors`, incl. "Tenant B cannot revoke Tenant A's
  collector"); type-check / lint / format / 825 tests all green.
- Staff add = auto-approved; parent propose = pending (authorised via active `parent_student_links`); parents cannot
  self-authorise unaccompanied release. Collection "door word" stored as a one-way scrypt hash.
- **Not done (by design):** parent-propose page is wired + logic-covered but not browser-exercised; check-out handover
  display (COL-05) deferred to the School Collection build.

### School Collection Service (Feature A) — Slice 1: run configuration (migration 079, verified)
- **Design:** [design/school-collection-and-authorised-collectors.md](design/school-collection-and-authorised-collectors.md).
- **Files:** migration `079` (`collection_methods`, `collection_runs`, `collection_run_staff`);
  `src/lib/collection/{collection.ts, actions.ts}` (**14 tests**); `/admin/collection` + `CollectionPanel`;
  sidebar link (Payments → School Collection).
- **What a crèche can do now:** configure its collection **methods** (per-crèche dropdown — Minibus / Walking bus /
  Gate collection / …) and create **school runs** (origin school, method, days, pickup time, capacity, chaperone
  ratio, **charge basis [per-day/weekly/per-term] + price**), assign chaperone staff, and see a **ratio warning**
  when a run is under-staffed for its capacity.
- **Verified:** migration applied + DB-checked (insert / CHECK constraints / unique / anon-blocked); **browser-tested**
  (add method → add run → €-charge + ratio warning rendered); **cross-tenant isolation test extended**
  (`scripts/verify-tenant-isolation.mjs` now covers `collection_methods`/`collection_runs`, incl. "Tenant B cannot
  modify Tenant A's run"); type-check / lint / format / 839 tests all green.
### School Collection Service (Feature A) — Slice 2: enrolment + charging (migration 080, verified)
- **Files:** migration `080` (`collection_enrolments` + `invoices.collection_enrolment_id`); enrolment status
  machine in `collection.ts` (+3 tests, **17 total**); `collection/actions.ts` (staff enrol, parent request with
  written consent, approve/decline/end, **generate charge**); admin `EnrolmentsPanel` on `/admin/collection`;
  parent `/parent/collection` + `ParentCollectionForm` + nav.
- **Charging:** an approved enrolment → `generateCollectionChargeAction` creates an **issued invoice**
  (run price × units) via the existing invoices table + `generate_invoice_number` RPC, linked by
  `collection_enrolment_id` — so it appears in `/admin/fees` and `/parent/invoices`.
- **Verified:** migration applied + DB-checked; **browser-tested** (enrol Emma Byrne → Approved → Generate charge →
  `INV-2026-000014`, €240 = 20×€12, issued, linked, snapshot `source: school_collection`); **cross-tenant test
  extended** (`verify-tenant-isolation.mjs` covers `collection_enrolments`, incl. "Tenant B cannot end Tenant A's
  enrolment" — 26 checks pass); type-check / lint / format / tests all green.
- **Not done (by design):** NCS school-age netting (charges gross for now — subvention refinement later);
  **parent payment** (Slice 4, provider-gated).

### School Collection Service (Feature A) — Slice 3: daily collection register (migration 081, verified)
- **Files:** migration `081` (`collection_register`: status CHECK machine, `UNIQUE(run,student,date)`,
  `released_to_collector_id` FK → `authorised_collectors`, RLS + grants); register status machine in
  `collection.ts` (+3 tests, **20 total**); `markRegisterAction` in `collection/actions.ts`; admin
  `/admin/collection/register` page + `RegisterPanel` (date picker, per-run tables, release-to-collector
  picker, undo); link from the collection page header.
- **Logic:** ties runs (A) to authorised collectors (B) — one row per enrolled child per day; lifecycle
  `scheduled → collected (from school) → released (to collector)` or `absent`, with undo paths.
  `markRegisterAction` is school_id-scoped, requires an **approved enrolment** for (run,child), and
  `released` requires an **approved authorised collector** belonging to that child; enforces the transition
  machine (no row = `scheduled`).
- **Verified:** migration `081` **applied** to DB (2026-10-03); **browser-tested end-to-end** on localhost —
  built method (Minibus) → run (After-school run, €12/day) → enrol Emma Byrne (Approved) → approved collector
  Mary Byrne → register: **Scheduled → Collected from school → Released to collector (Mary Byrne)**, Undo
  available, no console errors. type-check / lint / format / unit tests all green (**20/20** collection suite);
  `verify-tenant-isolation.mjs` extended to cover `collection_register` (scoping + RLS + "Tenant B cannot
  update Tenant A's register row"). Merged to main via **PR #31** (2026-10-03).

### School Collection Service (Feature A) — refinement: parent collection history (no migration, verified at data layer)
- **File:** read-only "Collection history" section added to `/parent/collection` (`src/app/(parent)/parent/collection/page.tsx`).
  Shows each day the parent's child was collected from school and released: date, child, run, register status,
  and which authorised collector took them (with time). Scoped to the parent's own child ids (from active
  `parent_student_links`), so a parent only sees their own children's entries. No schema change — reuses
  `collection_register` + the page's existing link resolution.
- **Verified:** type-check / lint / format green. Data-layer verified — the page's **exact query** (with the
  `students` / `collection_runs` / `authorised_collectors` FK embeds) returns the correct row
  (Emma Byrne → After-school run → released → Mary Byrne, with timestamps). A live parent-login render was
  not possible: the only parent linked to a child-with-history is also a platform/admin account, which the
  parent route guard redirects, and no parent-only account exists to seed from. Markup mirrors the already-
  verified "Your requests" table on the same page. Merged to main via **PR #32** (2026-10-03).

### School Collection Service (Feature A) — refinement: printable staff roster (no migration, verified)
- **File:** `/admin/collection/register/roster` (`src/app/(admin)/admin/collection/register/roster/page.tsx`) +
  a date-aware "Printable roster →" link on the register. A print-friendly sheet staff carry on the run: per
  active run a header (origin school, pickup, method, days, child count, chaperones assigned vs required with
  an **under-ratio** flag, assigned staff) and a table of enrolled children — Collected checkbox, each child's
  approved authorised collectors as tick-boxes, signature/time line; flags children with no approved collector.
- **Verified:** type-check / lint / format green; **browser-tested** on localhost (After-school run → Emma Byrne
  row, Collected box, "☐ Mary Byrne (parent)" collector tick, signature line, "0 assigned / 1 required ⚠ under
  ratio"). Reuses the existing global `@media print` chrome-hiding (globals.css, already used by reports/attendance)
  via `PrintButton`; no schema change. Branch `feat/collection-roster` (PR open).

### Pricing — single all-inclusive plan + no-card trial (migration 082 applied, verified)
- **Model (user decision 2026-10-03):** ONE plan — **€74.99/month** or **€809.89/year** (true 10% off, EUR) —
  unlocks every feature, **SMS included** (no separate Pro+SMS tier). **500 SMS/month** allowance (was 100;
  migration `082`, applied) + existing top-up credits. **First month free, no card**; paywall after 30 days.
- **Code:** `hasSmsAccess = hasProAccess`; webhook `sms_enabled = plan==='pro'`; removed `switchToProSmsAction`,
  `SwitchToSmsButton`, `getProSmsPrices`, SMS price-id env getters; checkout = single plan monthly/annual.
  `provision.ts` grants a no-card `trialing` sub (`trial_ends_at = +30d`); signup → `/admin/dashboard`;
  onboarding/billing retargeted to the post-trial subscribe step; pricing + admin-subscription pages reworked;
  platform MRR estimate → €74.99.
- **Verified:** tsc / eslint / prettier clean; **76** subscription/platform/env unit tests pass; browser-verified
  `/pricing` (one plan, "no card required", SMS 500/mo) and `/admin/subscription` (single plan, no upsell).
  Branch `feat/single-plan-pricing` (PR open). ⚠️ **Prices come from Stripe**: create the one product + two prices
  on the new account (Stripe activation Task S2) and set `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_ANNUAL_PRICE_ID`.
  The old `reference/stripe-pro-product` notes (€39.99/€420, two tiers) are superseded.

### Security — cross-tenant isolation review (2026-10-03)
- Static audit of every server-side data path + DB-backed `verify-tenant-isolation.mjs` (26 checks).
  **No cross-tenant data-isolation vulnerabilities found.** Full report:
  [security-review-cross-tenant-2026-10.md](security-review-cross-tenant-2026-10.md).
- Hardening applied: removed a dead client-callable `incrementPaymentLinkUseCount`; scoped
  `incrementPaymentLinkVisitCount` by `school_id`. Follow-up: scope `incrementPaymentLinkCompletedOrderCount` too.

---

## 🟡 Built but NOT fully verified — do NOT report as complete

| Item | Files | What's verified | What's NOT verified (gap to close) |
|---|---|---|---|
| **FEE-01** fee schedules (partial) | `fee_schedules` table (mig 071); `createFeeScheduleAction` | table applied; a row inserts via service-role script | **No `service_rates` table, no effective-dated rates, no overlap rejection, no "term" frequency.** Server action never exercised via UI; no automated test. |
| **FEE-02** child funding registrations | `child_funding_registrations` (mig 071); `upsertFundingRegistrationAction` | table applied; partial-unique + PPSN encrypt used; verified via script | **No automated test** for the constraint, encryption round-trip, or "PPSN never in logs". Action not integration-tested. |
| **FEE-04** invoice ledger (partial) | `invoices` (mig 071) + guard trigger | table + guard trigger verified via script | **State machine simplified** vs spec (`draft/issued/paid/part_paid/void` vs spec's 8 states); **no `invoice_lines` table**; not integration-tested. |
| **FEE-06** generation action | `generateInvoicesForScheduleAction` | engine 8 + 2 property tests; DB write path script-verified; **isolation + idempotency verified** via `scripts/verify-tenant-isolation.mjs` | Server action still **not exercised via authenticated UI**; isolation check is a manual script, not a CI job. |
| Invoice **issue/void** lifecycle | `issue/voidInvoicesForScheduleAction` + buttons | actions built; guard trigger verified | Not integration-tested via UI. |
| **FEE-07** parent invoice view | `/parent/invoices/page.tsx` | route compiles; auth guard redirects (HTTP 307) | **No data-render test** (needs a parent account linked to a child with issued invoices); **no parent-authz / a11y test**. |
| Admin fees UI | `/admin/fees`, `ChildBillingPanel.tsx` | renders; lists children; forms display; year-projection card renders | **End-to-end create→generate→issue not completed via UI** (browser date-picker automation blocked; the flow itself is untested end-to-end). |
| Daily records / enquiries admin UIs | `/admin/daily-records`, `/admin/enquiries` | pages render; engines + migrations tested/verified | **Create/update flows not exercised via automated E2E.** |
| Subvention report + commercial dashboard | `/admin/subvention-report`, `/admin/commercial` | engines tested; data layer script-verified | **No browser E2E**; commercial "occupancy" uses present-now, not licensed capacity. |
| Reminders preview | `/admin/reminders` | selection engine tested; page renders who is due | **Does not send** — no email/SMS dispatch wired (provider-gated). |

---

## 🔵 Inherited from the fork — reusable, NOT crèche-complete

Work for the **school** product; passes its own tests but **not verified for the crèche**. Do not report as done.

| Area | Where | Status for crèche |
|---|---|---|
| Multi-tenant core, Auth/RBAC, RLS + grants | `lib/tenant/*`, `lib/auth/*`; migs 003/004/009–021/033–036 | 🔵 reuse; new tables need own grants + RLS |
| Stripe Connect (per-tenant) **+ Revolut (per-tenant)** / Twilio SMS / Resend email | `lib/stripe|revolut|sms|email/*`; migs 055–057/066/**067** | 🔵 code complete & **both providers are per-crèche** (each collects its own payments); need per-crèche KYC/key + ComReg/domain activation + FEE-08 fee wiring |
| Orders, payment-links, refunds, reconciliation, subscriptions, documents, crypto | `lib/*` | 🔵 reuse; adapt to crèche fee flows |
| Attendance (per class session) | `lib/attendance/*`; migs 031/032/062 | 🔵 base reusable; **daily check-in + ratios now built on top** (see ✅ above) |
| Instalment math (school) | `lib/payments/instalments.ts`; mig 023 | 🔵 untouched; crèche uses the separate `lib/fees/instalments.ts` (FEE-09) |

---

## ⬜ Outstanding (not started / provider-gated)

**Fee/subvention:** FEE-08 pay invoice via a payment provider (needs each crèche's own KYC — FEE-09 instalment
engine already built to plug in). **Both provider paths are per-tenant and code-complete, but not yet wired to
crèche invoices and not activated in production** (see "Per-tenant payments" below). When FEE-08 is built it **must**
route through the same per-crèche resolvers (`stripeAccount: <tenant connect account>` / `resolveRevolutApiKey(schoolId)`),
never a shared platform account. Also: FEE-11 attendance true-up + Pobal claim accrual ledger, `service_rates`
(FEE-01), `invoice_lines` + full 8-state machine (FEE-04), parent invoice **payment** wiring, reminder **dispatch**
(email/SMS send).

**Per-tenant payments (Stripe Connect + Revolut) — architecture in place, activation pending.** Each crèche collects
its **own** payments straight into its **own** account once it sets up its portal — the platform is not the merchant
of record and takes no cut. Verified in code:
- **Stripe Connect (per-crèche):** `066_stripe_connect.sql`; onboarding via `/admin/payments/connect` (`ConnectStripeButton`
  → `connectActions.ts`); checkout runs on the tenant's account (`stripe/actions.ts` → `stripeAccount: connect.stripe_connect_account_id`);
  refunds use the same account. Status synced via `account.updated` webhook / on-return sync.
- **Revolut (per-crèche):** `067_revolut_per_school.sql` (encrypted `revolut_api_key_enc` / `revolut_webhook_secret_enc`
  on `schools`); the crèche enters its own key in `RevolutSettingsForm` on the same page; `resolveRevolutApiKey(schoolId)` /
  `resolveRevolutWebhookSecret(schoolId)` (`revolut/perSchool.ts`) are used at checkout, in the webhook route
  (`schoolIdFromExtRef` → per-school secret), and in refunds. Falls back to the platform key only if a crèche hasn't opted in.
- **Activities & Programmes are already per-tenant:** `/admin/activities`, `/admin/programmes` are `school_id`-scoped, so
  each crèche creates and charges for its own — payments flow through that crèche's connected Stripe/Revolut account.
- **Activation remaining (per crèche, user-gated):** each crèche completes Stripe Connect KYC and/or enters its own
  Revolut Business key + prod webhook; platform-level Stripe/Revolut prod keys set in Vercel as the fallback; then a
  sandbox pay + refund smoke per provider.

**P0 crèche scope still open (spec):** compliance centre + inspection exports + retention/DPIA (§7.7);
tenant funding-settings UI (FEE-03); "term" fee frequency; licensed-capacity modelling for true occupancy.
*(Now done from the earlier open list: ratio UI, daily check-in, daily records, enquiry/waiting-list CRM,
arrears + reminders preview, subvention/Pobal-prep report, commercial dashboard.)*

**DevSecOps (spec §11):**
- ✅ GitHub remote + PR CI (lint/type/format/unit/build); ✅ secret scanning + push protection active; ✅ anon-read
  lock-down (migs 074/075).
- ⬜ **Branch protection** on `main` (required checks, no bypass) — checklist ready in `docs/setup/github-branch-protection.md`.
- ⬜ Wire `scripts/verify-tenant-isolation.mjs` into a DB-enabled CI job; get the E2E job actually passing.
- ⬜ SAST/Semgrep, SCA/Dependabot updates, Trivy, DAST/ZAP, SBOM; DPIA + threat-model sign-off (children's special-category data).

---

## Manual configuration steps

1. **Deps:** `npm ci` (Windows: slow first run, ~10 min — normal).
2. **`.env.local`** is present and filled for the dev Supabase (`xpbavfutfejlfbmnntyl`) + `ENCRYPTION_KEY` + `CRON_SECRET`;
   Stripe/Resend/Twilio are placeholders. Never commit (gitignored).
3. **Applying future migrations:** no `SUPABASE_DB_URL`/psql/management token is configured here, so DDL is applied by
   **pasting the migration into the Supabase SQL editor** (that is how 068–077 were applied). To automate later, set a
   connection string and use `npm run db:migrate` (`supabase db push`).
4. **Confirm NCS/ECCE rates** with a Pobal/finance SME and load into FEE-03 config; replace the `CONFIRM` fallbacks.
5. **Confirm the reference Irish room ratios** in `src/lib/ratios/ratio.ts` (flagged CONFIRM) — the ratio **UI is now
   live**, so these constants are user-facing; confirm before pilot.
6. **⚠️ Remove `src/app/api/dev/` before production** (dev-only seed/Pro-unlock route).
7. **Enable branch protection on `main`** now (repo exists + CI runs): `docs/setup/github-branch-protection.md`.
8. **Before pilot / go-live:** Stripe Connect + Revolut KYC; ComReg/Twilio A2P; email sender-domain (SPF/DKIM/DMARC);
   DPIA. Provider + Vercel steps: [provider-setup.md](provider-setup.md), [deploy-checklist.md](deploy-checklist.md),
   [domain-setup-crechewise.md](domain-setup-crechewise.md).

---

## Security considerations (spec §10 + fork lessons)

- **Service-role bypasses RLS** — every admin-client query must include its own `school_id` filter (RLS is a second boundary,
  not the only one). The DB has **2 schools**, so cross-tenant leakage is testable right now.
- **New tenant-owned tables need their own grants + RLS + a cross-tenant negative test in the same PR** (release-blocking).
  `fee_schedules`/`invoices`/`child_funding_registrations` have grants + RLS, and **isolation is verified** by
  `scripts/verify-tenant-isolation.mjs`. `daily_check_ins`, `daily_records`, `enquiries` created with the same
  grants+RLS pattern and script-verified anon-blocked. Wiring isolation into a DB-enabled CI job is still outstanding.
- **Anon-key lock-down (migs 074/075):** `reference_sequences` had RLS off (linter finding) → now RLS + revoked;
  `teachers`/`classes` had inherited anon-readable policies → dropped + `SELECT` revoked after auditing that **all**
  reads use the service-role client. Final anon sweep returns no rows from any tenant table.
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
npm run test -- run             # full vitest suite (897 tests / 78 files as of 2026-10-06)
npm run type-check              # tsc --noEmit
npm run lint                    # eslint src
npm run format:check            # prettier --check  (CI blocks on this)
npm run test:e2e                # Playwright (needs app running + env) — not yet run

# run the app (this session used a background dev server on :3000)
npm run dev                     # http://localhost:3000  (first compile ~55s on Windows)
# if type-check shows phantom errors after switching branches:
rm -rf .next/types && npm run type-check

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
1. **Funding & Hive Centre** (see the dedicated section above): extend tenant-isolation to the three uncovered Phase 2–4
   tables (release-blocker), wire operational mutations → compliance (addendum §9), then Phase 5 (AIM) behind its own
   permission + privacy review. (Branch protection on `main` is already **enabled** — ruleset "protect-main".)
2. **Set up providers** (Resend → Twilio → payments) per [provider-setup.md](provider-setup.md), then **deploy to Vercel**
   per [deploy-checklist.md](deploy-checklist.md) + [domain-setup-crechewise.md](domain-setup-crechewise.md). Payments are
   **per crèche**: set the platform-level Stripe/Revolut prod keys in Vercel as the fallback, then **each crèche** connects
   its own Stripe account (Connect KYC) and/or enters its own Revolut Business key + prod webhook from `/admin/payments/connect`.
   Run a sandbox pay + refund smoke per provider before go-live.
3. **Unblock FEE-08** once a crèche's payment provider is active: wire invoice payment through the **per-tenant** resolvers
   (Stripe Connect account / `resolveRevolutApiKey(schoolId)`), FEE-09 instalment engine plugs in, then verify in sandbox.
4. Add the still-missing automated tests: PPSN-never-logged, parent invoice authz/render, and a DB-enabled CI isolation job.
