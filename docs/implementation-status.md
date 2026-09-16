# Crèche Platform — Implementation Status

> **Supersedes** the inherited Skool Bido / Scoil Bhríde status log (this repo is a fork per
> [adr/ADR-001-fork-existing-stack.md](adr/ADR-001-fork-existing-stack.md)). Governing spec: the
> Crèche Management Platform Master Specification. Design: [design/fee-subvention-engine.md](design/fee-subvention-engine.md),
> [design/reuse-map.md](design/reuse-map.md). Tickets: [backlog/p3-fee-subvention-tickets.md](backlog/p3-fee-subvention-tickets.md).

**Project:** Crèche Management Platform (First Stack Solutions)
**Last updated:** 2026-09-16
**Honesty rule:** only features with passing automated tests in this repo are marked ✅. Inherited-but-unadapted
code is marked 🔵 (reusable, NOT crèche-complete). Everything else is ⬜ outstanding.

---

## Verification snapshot (2026-09-16)

| Check | Command | Result |
|---|---|---|
| Unit/integration tests | `npm run test -- run` (`vitest run`) | ✅ **684 passed** / 51 files (incl. 18 FEE-05) |
| Type-check | `npm run type-check` | ✅ exit 0, clean |
| Lint | `npm run lint` | ✅ exit 0, clean |
| E2E (Playwright) | `npm run test:e2e` | ⬜ **not run** (needs running app + env) |
| Security scans (SAST/SCA/secrets/DAST) | — | ⬜ **not set up** (spec §11.4) |

Branch: `feature/FEE-05-subvention-engine` (base `main`). Not pushed — **no GitHub remote yet.**

---

## ✅ Completed & verified in this repo (crèche-specific)

### FEE-05 — ECCE + NCS subvention calculation engine
- **Files:** `src/lib/payments/subvention.ts`, `src/lib/payments/__tests__/subvention.test.ts`.
- **What it does:** pure, server-authoritative netting — gross fee − ECCE (zero-rated) − NCS (hourly, capped) = parent net; plus provider Pobal receivables. Integer cents; deterministic ECCE→NCS→discount ordering; net never negative; subsidy never exceeds fee; ECCE 3h/day, 15h/week, term-time only; higher-capitation flag.
- **Spec coverage:** §8 subvention math; supports §8.5 (fee projection) and §8.6 (state inputs) once the ledger (FEE-04) exists.
- **Tests:** 18 passing incl. the design worked example (€150 gross → €96.50 net; €69 ECCE + €53.50 NCS receivable), single-scheme, caps, no-profit/never-negative, rounding, exact period sums, property loop.
- **⚠️ Data caveat:** rate constants (`NCS_UNIVERSAL_HOURLY_RATE_CENTS`, `DEFAULT_ECCE_CONFIG`) are **2025/26 reference values flagged `CONFIRM`** — must be verified with a Pobal/finance SME before go-live and normally sourced from effective-dated config (FEE-03), not these fallbacks.
- **Not yet:** not wired to any DB, invoice, or UI. It is a calculation library only.

### Project setup
- Repo forked from Skool Bido (`scoil-bhride-portal`); secrets (`.env.local`, Revolut key) and artifacts excluded; fresh git history; planning/design docs added under `docs/{adr,design,backlog}`.

---

## 🔵 Inherited from the fork — reusable, NOT crèche-complete

These work for the **school** product and pass their own tests, but are **not verified for the crèche** and mostly
require the domain rename + fee wiring before they count. Do **not** report these as done for the crèche pilot.

| Area | Where | Status for crèche |
|---|---|---|
| Multi-tenant core (subdomain/path, no default tenant) | `lib/tenant/*`; migs 003/033/034/054 | 🔵 reuse as-is (rename `school`→`tenant`) |
| Auth / RBAC / sessions | `lib/auth/*`; migs 004/009/036 | 🔵 reuse; map roles to spec role matrix |
| RLS + service-role/anon grants | migs 010/019–021/035 | 🔵 reuse; **new tables need their own grants + RLS** |
| Stripe Connect (per-tenant, Standard, direct charge) | `lib/stripe/connect*`; mig 066 | 🔵 code complete; needs KYC activation + fee wiring (FEE-08) |
| Revolut per-tenant + webhook signature | `lib/revolut/*`; mig 067 | 🔵 code complete; needs KYC + wiring |
| Twilio SMS (E.164, delivery webhook, credits) | `lib/sms/*`; migs 055–057 | 🔵 code complete; needs ComReg/A2P activation |
| Email (Resend, templates, from/reply-to) | `lib/email/*` | 🔵 reuse; needs sender-domain verification |
| Parent messaging, orders, payment-links, refunds, reconciliation, subscriptions, onboarding, documents, crypto | `lib/*`; migs 007/008/014/023/038–045/063/065 | 🔵 reuse; adapt to crèche fee flows |
| Attendance (per class session) | `lib/attendance/*`; migs 031/032/062 | 🔵 base reusable; reshape to daily check-in + ratios |
| Instalment math | `lib/payments/instalments.ts`; mig 023 | 🔵 math reusable; **rules diverge from spec — see FEE-09 below** |

---

## ⬜ Outstanding work (not started / not built)

**P3 fee & subvention (remaining tickets — see backlog):**
- ⬜ FEE-01 service rates & fee schedules (schema)
- ⬜ FEE-02 child funding registrations (CHICK, PPSN encrypted)
- ⬜ FEE-03 effective-dated funding config + tenant settings (**feeds real rates into FEE-05**)
- ⬜ FEE-04 invoice + line ledger + state machine
- ⬜ FEE-06 invoice generation job
- ⬜ FEE-07 parent transparent breakdown view
- ⬜ FEE-08 pay invoice via Connect (needs KYC)
- ⬜ FEE-09 instalment reshape — **spec §8.4/§12.1 require `>€20` (€20.00 excluded) + configurable 2/3/4 + frequency + first date**; current inherited code is `≥€20` fixed-4. Known divergence; not changed yet (school relies on current behaviour).
- ⬜ FEE-10 arrears reminders + outstanding-balance dashboard
- ⬜ FEE-11 attendance true-up + Pobal claim accrual ledger

**Other P0 crèche scope (spec):**
- ⬜ Domain reshape: `classes/students`→`rooms/children`, `teachers`→`staff` (~65 files) — blocks clean naming of all fee tables
- ⬜ Room ratio calculations + staffing forecast (§7.4/7.5)
- ⬜ NCS/ECCE Hive-prep reports + absence/under-attendance alerts (§7.7; no Hive API)
- ⬜ Enquiry/waiting-list CRM crèche-adaptation (§7.3)
- ⬜ Daily records (sleep/nappy/meal/incident/medication) (§7.6)
- ⬜ Guided XLSX/CSV import wizard (§5.4) — extend existing CSV upload
- ⬜ Compliance centre + inspection exports + retention (§7.7)
- ⬜ Commercial dashboard: occupancy, revenue by room/session (§7.8)

**Delivery/DevSecOps (spec §11):**
- ⬜ GitHub remote + branch protection + PR pipeline
- ⬜ CI gates: SAST/Semgrep, SCA/Dependabot, Gitleaks, Trivy, DAST/ZAP, SBOM
- ⬜ DPIA + threat model sign-off (children's special-category data)

---

## Manual configuration steps (before the app runs / before pilot)

1. **Install deps:** `npm ci` (Windows: slow, ~10 min — this is normal).
2. **New Supabase project** — do NOT reuse the school prod DB (`jywkpenzhzzptsrntobf`). Apply migrations 001–067 to the new project, then crèche migrations as built.
3. **`.env.local`** — copy from `.env.example`, fill new Supabase URL/keys and provider keys. Never commit (gitignored).
4. **Rename** `package.json` name from `scoil-bhride-portal`.
5. **New GitHub repo** (not `Primary-School-Mgt-System`); `git remote add origin …`; push `main` + feature branch; enable branch protection.
6. **Day-0 external long poles** (see [backlog/day-0-action-pack.md](backlog/day-0-action-pack.md)): Stripe Connect application, Revolut Business KYC, ComReg/Twilio A2P, email sender-domain (SPF/DKIM/DMARC), DPIA.
7. **Confirm NCS/ECCE rates** with a Pobal/finance SME (fee-subvention-engine.md §7) and load into FEE-03 config; swap out the `CONFIRM` fallback constants.

---

## Security considerations (carry forward — spec §10, and fork lessons)

- **Service-role bypasses RLS** — every query via the admin client must include its own `tenant/school` filter. RLS is a second boundary, not the only one.
- **New tenant-owned tables** need explicit `service_role` (+ `authenticated` SELECT) grants and RLS policies, and a **cross-tenant negative test in the same PR** (release-blocking).
- **PPSN + health/allergy/medical** are special-category — encrypt at rest (`lib/crypto`), never log, never echo into error telemetry.
- **No sequential public IDs** (use UUID/ULID) to prevent enumeration.
- **Financial ops idempotent + audited**; verify provider webhook signatures before state changes.
- **Never log** secrets, card data, health details, or full payment/message payloads.
- FEE-05 itself touches no DB, so it has no tenant-isolation surface; isolation tests attach to FEE-01/02/04.

---

## Exact commands to continue

```bash
# from the repo root: E:\First Stack Solutions\Creche_Mgt_System
npm ci                                   # install deps (first time)
npm run test -- run                      # full unit/integration suite (vitest)
npm run test -- run src/lib/payments/__tests__/subvention.test.ts   # FEE-05 only
npm run type-check                       # tsc --noEmit
npm run lint                             # eslint src
npm run test:e2e                         # Playwright (needs app running + env)

# git (already on the feature branch)
git status
git log --oneline -5

# once a GitHub remote exists:
# git remote add origin <new-repo-url>
# git push -u origin main
# git push -u origin feature/FEE-05-subvention-engine   # then open the PR
```

**Recommended next ticket:** FEE-03 (effective-dated funding config) — no external blocker, feeds real ECCE/NCS
rates into FEE-05, and is the natural precursor to the FEE-01/02/04 schema spine.
