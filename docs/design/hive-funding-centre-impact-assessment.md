# Funding & Hive Centre — Phase 0 Repository Impact Assessment

> **Spec:** _Creche Wise | Early Years Hive & Funding Automation — Claude Code Implementation Addendum_ (research current to 3 Oct 2026).
> **Branch:** `feature/hive-funding-centre`. **Status:** Phase 0 discovery — the spec gate is "no code until duplication risks, event sources and migration plan are documented." This document is that gate.
> **Golden rule:** reuse & extend existing modules; additive, reversible migrations; feature-flagged per tenant; proactive compliance engine (not competitor parity); **no direct Hive automation** (ManualHiveAdapter only).

---

## 1. Current architecture summary & stack

- **Framework:** Next.js 15 (App Router, RSC + server actions), TypeScript (`exactOptionalPropertyTypes`), Tailwind semantic tokens.
- **Data:** Supabase (Postgres + RLS). All app data access goes through the **service-role admin client** (`createSupabaseAdminClient`), which **bypasses RLS** — so every query is manually scoped by `school_id`. RLS is enabled deny-by-default as a backstop. **No default privileges**: every table needs explicit `GRANT` (SELECT→authenticated, full→service_role; migrations 019–021 pattern).
- **Auth/RBAC:** `getSessionUser()` builds a `SessionUser` with `roles` (via `user_roles`→`roles`) and `permissions` (via the `get_user_permissions` RPC). Guards: `requireAdmin`, `requireTeacher`, `requireParent`, `requireVerifiedAuth`, `requirePermission(name)`. Permission names use `domain.action` (seed migration 009).
- **Tenancy:** keyed on `school_id` (FK `schools`); `SessionUser.schoolId`. Parent access via `parent_student_links`. Cross-tenant isolation is regression-tested by `scripts/verify-tenant-isolation.mjs`.
- **Migrations:** plain SQL in `supabase/migrations/NNN_*.sql`, applied **manually** by the owner in the Supabase SQL editor (prod ref `xpbavfutfejlfbmnntyl`). Conventions: TEXT+CHECK enums, `school_id`-scoped, `set_updated_at` trigger (migration 003), RLS enable, explicit grants.
- **Secrets:** `ENCRYPTION_KEY` drives app-layer field encryption (`src/lib/crypto`), already used for Revolut keys **and** `child_funding_registrations.pps_number_encrypted`.
- **Docs/storage:** `src/lib/documents` + private buckets served via short-lived **signed URLs** (same pattern as assignments/observations).
- **Notifications:** email (Resend) + SMS (Twilio, allowance-metered); tenant preferences.
- **Scheduled jobs:** `src/app/api/cron/*` routes guarded by `CRON_SECRET` (e.g. `permission-slip-reminders`).
- **Audit:** append-only audit log written from server actions across the app.
- **Deploy/CI:** GitHub → Vercel auto-deploy on `main`; branch protection requires PR + Lint & Type Check / Unit Tests / Production Build; vitest + ESLint + Prettier gates.

---

## 2. Existing modules / tables / routes to REUSE (do not rebuild)

| Spec concept | Already in Creche Wise | How we reuse |
|---|---|---|
| Child / parent / guardian | `students`, `parent_student_links`, `profiles` | FK only; never copy identity into funding tables. |
| **Raw attendance (NCS source of truth)** | `daily_check_ins` (`checked_in_at`, `checked_out_at`, `date`, `status`) + `attendance_sessions`/`attendance_records` | NCS weekly engine derives actual minutes from `daily_check_ins`; **never writes back**. |
| **NCS/ECCE registration + CHICK + PPSN** | `child_funding_registrations` (scheme, status, `chick_code`, `ncs_subsidy_type`, `awarded_hourly_rate_cents`, `awarded_weekly_hours`, `ecce_programme_year`, `higher_capitation`, **`pps_number_encrypted`**) | This is the spec's `ChildFundingProfile` nucleus — **extend**, don't duplicate (see §10). |
| **Funding reference rates + per-tenant toggles** | `funding_scheme_versions` (national, effective-dated ECCE/NCS rates in JSONB) + `tenant_funding_settings` (ecce/ncs enabled, billing model) | Foundation for `FundingProgrammeConfig` / `FundingRulesService`. |
| **Subvention / co-payment maths** | `src/lib/payments/subvention.ts`, `funding-config.ts` | Reuse for the co-payment calculator; add reconciliation vs billing. |
| **Fees / invoices / discounts** | `src/lib/fees/*` (schedule, invoice, instalments, arrears, reminders, projection, receivables) | Co-payment reconciliation reads the fee plan + actual invoice. |
| Rooms / sessions / capacity | `classes` (= "rooms"), ratios, room capacity | Feed Core Funding shadow profile + ECCE session validation. |
| Staff / HR | `teachers` (= "staff"), roles, qualifications | Core Funding drift detection (departures, hours, capacity). |
| Calendar / closures | service calendar / closures | NCS service-calendar + closure handling + bridging reminders. |
| Documents / evidence | `src/lib/documents` + private bucket + signed URLs | Evidence packs, Parent Statement, submission snapshots (PDF/CSV). |
| Notifications | Resend email + Twilio SMS + prefs | Funding action/deadline templates (no sensitive identifiers in text). |
| Audit log | append-only audit writes | Add funding event types + sensitive-access events. |
| RBAC / tenancy | `get_user_permissions` RPC, `requirePermission`, `school_id` scoping, `verify-tenant-isolation.mjs` | Add `funding.*` permissions; no alternate auth path; extend the isolation suite. |
| Cron | `api/cron/*` + `CRON_SECRET` | New idempotent, tenant-safe funding jobs. |

---

## 3. Gap list — new domain objects / services / routes / screens

**New tables (additive, all `school_id`-scoped, RLS + grants + `set_updated_at`):**
- `funding_programme_config` — programme (NCS/ECCE/CORE_FUNDING/AIM) × programme_year, `rules_version`, `submission_deadline_config` JSONB, `active`. (Complements, not replaces, `funding_scheme_versions`.)
- `ncs_claim_versions` — versioned claim lifecycle (DRAFT→READY→VERIFIED→SUBMITTED_EXTERNALLY→SUPERSEDED), term/non-term hours, weekly fee/minutes, ECCE subsidy, discount, `calculated_copayment`, override + reason, `source_fee_plan_id`, audit timestamps.
- `ncs_weekly_compliance_snapshots` — one per (tenant, child, week_start): actual minutes, monitoring value, claimed hours, under-attended / full-week-absent booleans, consecutive counters, `threshold_event` (NONE/ABSENCE_4/UNDER_8/UNDER_12), `service_closure_effect`, `special_circumstances_status`, `calculation_version`. **Immutable.**
- `hive_action_items` — prioritised cross-programme queue: programme, action_type, entity_type/entity_id, severity (INFO/ACTION/URGENT), due_at, status (OPEN/IN_REVIEW/VERIFIED/COMPLETED/DISMISSED_WITH_REASON), reason_code/description, assigned_to, evidence_document_id, completion audit.
- `funding_submission_snapshots` — canonical JSON payload + rendered PDF/CSV ref + data-source/rule versions + verifier + external-submission evidence. **Immutable.**
- `core_funding_shadow_profiles` + `core_funding_change_events` — last verified snapshot + detected drift (staff/room/hours/capacity/weeks), manager classification.
- `aim_cases` — restricted domain (consent metadata, status, evidence doc links, audit); reuses child/guardian records, **never** copies general health data.
- `funding_programme_readiness` (+ items) — per programme-year checklist with per-item status (Current/Review Required/Missing/Submitted/Not Applicable) linked to source records.
- **Feature flag:** add `hive_centre_enabled BOOLEAN DEFAULT FALSE` to `tenant_funding_settings` (existing per-tenant table) — ships dark.

**Extend existing (additive columns only):**
- `child_funding_registrations` → add the few `ChildFundingProfile` fields not present (`ncs_award_expiry`, `ncs_parent_confirmation_status`, `ecce_session`, `aim_status`, `ncs_claimed_hours` if distinct from `awarded_weekly_hours`, `effective_from/to` if needed).

**New services (internal application services):**
`FundingRulesService`, `NcsComplianceService`, `NcsCopaymentService`, `HiveActionService`, `FundingSnapshotService`, `ProgrammeReadinessService`, `CoreFundingComparisonService`, `HiveIntegrationAdapter` (interface) + `ManualHiveAdapter`, `FundingAuditService`. Plus a **`FundingEventBus`** (or direct service calls) so operational mutations publish domain events that trigger compliance evaluation.

**New routes/screens** (`(admin)/admin/funding/*`, reuse existing design system): Funding dashboard, NCS weekly return, NCS claims & co-payments, ECCE registrations, Programme Readiness, Core Funding, AIM cases, Hive action queue, Exports & evidence. Plus a **Funding panel/tab on the child profile**. New permissions gate visibility.

---

## 4. Migration & rollback plan

- **Phase-1 migrations are purely additive** (new tables, new columns, indexes) — migrations `084+`. No drops/renames of production columns.
- `child_funding_registrations` is **altered with new nullable columns only** — fully backward-compatible with the existing subvention/fee engine.
- Feature flag defaults OFF; existing tenants see no change until explicitly enabled.
- **Backfill** `ChildFundingProfile` data only where reliable source data exists; otherwise create an onboarding action rather than guessing. Historical attendance untouched; weekly snapshots back-calculated only on request when attendance quality is sufficient.
- Historical NCS actions default to **UNKNOWN/UNVERIFIED** — never retro-infer a Hive submission.
- Each additive migration ships with a documented rollback (drop new table/column) where the project standard permits; snapshots are immutable so rule changes never rewrite history.

---

## 5. Security / privacy impact assessment (CHICK, PPSN, AIM)

- **PPSN** already encrypted at rest (`pps_number_encrypted` via `src/lib/crypto`, `ENCRYPTION_KEY`). Keep encryption; **mask by default** in UI; reveal/export gated by `funding.view_sensitive_identifiers`; every reveal/export audited; documented retention/deletion.
- **CHICK** treated as sensitive — masked by default, same reveal permission + audit.
- **AIM** = health/developmental data → **narrower** permission set (`funding.manage_aim`), field-level masking, explicit parent/guardian consent metadata, secure document links, dedicated audit events. Never copy general health data into AIM for convenience.
- **Never** place PPSN/CHICK in logs, analytics, error messages or notification text.
- Signed export URLs are tenant/user-authorised and short-lived (reuse documents signed-URL pattern).
- **Tenant isolation:** every funding query scopes by authenticated `school_id` **and** resource id; a guessed UUID from another tenant must return nothing. Extend `verify-tenant-isolation.mjs` with every new funding table + "Tenant B cannot attach Tenant A child/staff/doc to a funding record" + "signed export URL not reusable across tenants".
- New `funding.*` permissions (view, manage_ncs, manage_ecce, view_sensitive_identifiers, manage_core, manage_aim, export, mark_submitted, override_calculation) seeded + mapped to roles; AIM/sensitive perms NOT granted by default.

---

## 6. Feature-branch plan & sequence

Base branch `feature/hive-funding-centre`; each phase is its own PR off it (or off main once earlier phases merge), behind the tenant flag, with full gates + security review for sensitive phases.

| Phase | Branch | Scope | Gate |
|---|---|---|---|
| 0 | `feature/hive-funding-centre` | This assessment | Documented duplication risks, event sources, migration plan |
| 1 | `feat/funding-ncs-compliance` | Profile extension, FundingRules, weekly calculator, 4/8/12 + pre-threshold, action queue, weekly return pack | Unit/integration/cross-tenant pass; proactive generation proven |
| 2 | `feat/funding-ncs-copayment` | Claim versions, co-payment calc + billing reconciliation, PDF/CSV | Mandatory-field + historical-version tests |
| 3 | `feat/funding-ecce-readiness` | ECCE prep, sensitive-identifier controls, service calendar, Fee Table/readiness checklist | Permission/security review |
| 4 | `feat/funding-core` | Shadow profile, room/staff drift, R&C prep | Comparison accuracy signed off |
| 5 | `feat/funding-aim` | Restricted AIM workflow, consent/evidence | Privacy/permission review before enable |
| 6 | (future) | Approved Hive API/import adapter only if authorised | Contract + security review |

---

## 7. Test plan (mapped to spec §17 acceptance scenarios)

- **Pure unit** (`src/lib/funding/*`): 4-week absence; under-attendance reset after compliant week; 8-week + 12-week action generation; service-closure doesn't wrongly reset/count; term/non-term switch on effective date; ECCE hours excluded from NCS; co-payment calc (fee, hours, ECCE subsidy, discount); claim edits after 31 Jul 2026 require co-payment; **rule versions reproduce historic calculations**.
- **Integration**: attendance→snapshot→action; staff departure→Core drift→review; fee change→claim mismatch→action **without invoice mutation**; ECCE prep pulls correct data; readiness pulls org/service/calendar/fee-table; verified snapshot unchanged after later live edits; **week-6/7 risk before week-8**; service-calendar change→impact action; CHICK/award expiry→proactive action; room/weeks change→Core drift.
- **Cross-tenant/permission** (extend `verify-tenant-isolation.mjs`): all funding tables scoped; no cross-tenant FK attach; no PPSN/CHICK reveal without permission; NCS-perm user can't read AIM; signed URL not reusable; scheduled jobs never mix tenants.
- **E2E**: the 15 acceptance scenarios in spec §17.4.
- Gate: cross-tenant, sensitive-data, permission, unit, integration + E2E green in CI before each merge.

---

## 8. Competitive-gap map (baseline vs proactive differentiation)

| Capability | Baseline (parity — necessary, not sufficient) | Creche Wise proactive differentiation |
|---|---|---|
| NCS under-attendance | 8-week warning after breach | **Week-6/7 pre-threshold risk** with projected breach date |
| Weekly return | One-click CSV export | Auto-calculated **exception queue** + immutable evidence snapshot |
| CHICK/award | Expiry alert | Proactive action **+ cross-module consequences**, no sensitive data in notice |
| Fee/discount change | (manual) | Auto-recalc co-payment + **mismatch action**, never silently mutate invoice |
| Staff/room/weeks change | (manual Review & Confirm) | **Core Funding drift detection** before the R&C window |
| Hive file | Import/reconcile (reactive) | **Prepare + validate + explain** proactively; action-centric, not file-centric |
| Everything | A pile of funding screens | **One prioritised, explainable "Hive Actions Required" queue** driven by operational events |

Definition of Done explicitly rejects a parity-only build.

---

## 9. Event-source map (which operational changes trigger compliance evaluation)

| Operational change (existing module) | Emits event | Compliance consequence |
|---|---|---|
| `daily_check_ins` insert/edit | AttendanceRecorded | Weekly NCS snapshot recalcompute; threshold evaluation |
| Weekly reporting-week close (cron) | ReportingWeekClosed | Build snapshots + actions for all active NCS children |
| `child_funding_registrations` change (CHICK/award/hours/dates) | FundingRegistrationChanged | Re-prepare claim; expiry scan; parent-confirmation state |
| Fee plan / discount / contracted hours change (`fees`) | FeePlanChanged | Recalc future co-payment; billing mismatch action |
| ECCE session change (child w/ AIM L7) | EcceSessionChanged | Revalidate ECCE AM/PM; AIM impact flag |
| Staff leave / hours / role change (`teachers`) | StaffChanged | Core Funding drift review item |
| Room capacity / session / operating-weeks change (`classes`/calendar) | RoomOrCalendarChanged | Core Funding drift; ECCE session validation; NCS service-calendar/closure |
| Service closure / calendar change | ServiceCalendarChanged | NCS calendar + closure classification + bridging reminder |
| Programme-readiness item stale/incomplete (cron scan) | ReadinessDrift | Show exact missing/stale item + deadline |
| CHICK/award approaching expiry (cron scan) | AwardExpiryApproaching | Manager action + optional parent reminder (no sensitive id) |

Implementation: existing mutating server actions publish these events (lightweight in-process dispatch to `HiveActionService`/comparison services) + daily cron scans for time-based triggers. All idempotent + tenant-safe.

---

## 10. Conflicts with the codebase & safest resolution

1. **`child_funding_registrations` vs spec `ChildFundingProfile` / `NcsClaimVersion`.** *Conflict:* the spec models a separate profile + claim-version tables; we already have an authoritative registration table used by the live subvention/fee engine. *Resolution (safest):* **extend** `child_funding_registrations` with the missing profile fields (additive nullable columns) and add a **separate `ncs_claim_versions`** table for the versioned claim lifecycle that FKs the registration. Do **not** fork a parallel profile table — that would duplicate CHICK/PPSN and risk divergence. Document the mapping.
2. **`funding_programme_config` vs existing `funding_scheme_versions` + `tenant_funding_settings`.** *Resolution:* keep `funding_scheme_versions` as the national rate reference; add `funding_programme_config` only for programme-year **workflow** rules (deadlines, thresholds, required fields, rules_version). `FundingRulesService` reads both.
3. **No generic tenant feature-flag system.** *Resolution:* add `hive_centre_enabled` to `tenant_funding_settings` (per-tenant table already exists) rather than build a flag framework.
4. **"Rooms"/"staff" naming.** The spec's rooms = our `classes`; staff = our `teachers`. Map in code; no rename.
5. **Co-payment vs existing subvention engine.** *Resolution:* reuse `src/lib/payments/subvention.ts` for the maths; the new `NcsCopaymentService` adds the **three-way reconciliation** (contract/fee plan vs state supports vs actual invoice) and raises an action on mismatch — it never mutates invoices.
6. **Scheduled jobs.** Reuse the `api/cron/*` + `CRON_SECRET` pattern; all new jobs idempotent and tenant-scoped.
7. **Hive has no API** (PSB Data Catalogue: NCS + Early Years Platform = "API Available: No"). *Resolution:* `HiveIntegrationAdapter` interface + `ManualHiveAdapter` (prepare/validate/export only). No scraping or automated login. ever.

---

## Recommended start

Phase 1 (`feat/funding-ncs-compliance`) is the highest-value, most self-contained slice and exercises the whole proactive pattern end-to-end (attendance → snapshot → explainable action). It should land first, behind the `hive_centre_enabled` flag, with the pure weekly-calculation logic built test-first.
