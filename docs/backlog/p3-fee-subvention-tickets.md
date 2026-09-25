# P3 — Fee Engine + Subvention: Ticket Breakdown

**Status:** Draft tickets · **Date:** 2026-09-16
**Design source:** `docs/design/fee-subvention-engine.md` · **Reuse context:** `docs/design/reuse-map.md`

**Grounding in existing code** (read 2026-09-16):
- Money: integer `*_cents`, `currency DEFAULT 'EUR'`, status **enums** (`order_status`, `payment_status`, `payment_provider`), snapshots + locked prices, `set_updated_at` trigger, per-row RLS. (mig 007)
- Partial payments already solved: `orders.amount_paid_cents`, `orders.payment_type ('full'|'installment')`, `status='partially_paid'`, multiple `payments` rows unique per `(order_id, provider_checkout_session_id)` for webhook idempotency. (mig 023)
- Charge rail to reuse: `lib/stripe/actions.ts` → `checkout.sessions.create({...}, { stripeAccount: connectedAccountId })` = direct charge on the tenant's connected account; refunds via `lib/refunds/actions.ts` with the same `stripeAccount`.
- **Naming:** new tables use `school_id` to match the current schema and integrate immediately; they get renamed to `tenant_id` with the P1 domain rename. `child_id` FKs `students(id)` (→ `children` after rename).

> Every ticket: server-side authz + `school_id` scoping, cross-tenant negative test in the **same PR**, financial ops idempotent + audited, migrations backward-compatible. (spec §16)

---

## FEE-01 — Service rates & fee schedules (schema + service)
**Goal:** let a tenant define recurring childcare fees (per service/room/age band) that generate obligations ahead of time.
**Depends on:** existing `schools`, `rooms/classes`. **New migration.**
**Schema:**
- `service_rates` (school_id, name, room_id?, age_band?, `hourly_rate_cents`, optional session/day/week display rates, `effective_from`, `effective_to`, audit) — effective-dated, no overlap per scope.
- `fee_schedules` (school_id, child_id, service_rate_id, frequency `weekly|fortnightly|monthly|term|annual`, `effective_from/to`, status).
**Acceptance:**
- CRUD rates/schedules with dropdown controls (spec UX); rates effective-dated; changing a rate never mutates an already-issued invoice.
- All amounts integer cents, EUR; validation via `zod` + server action (mirror `lib/schools/schemas.ts`).
**Tests:** overlap rejection; effective-date selection; tenant isolation.
**Effort:** M.

## FEE-02 — Child funding registrations (ECCE/NCS, CHICK, PPSN)
**Goal:** capture the authoritative award data per child.
**Depends on:** FEE-01, `students`, `lib/crypto`.
**Schema:** `child_funding_registrations` (design §2.2): scheme `ECCE|NCS`, status, start/end; NCS: `chick_code`, `ncs_subsidy_type`, `awarded_hourly_rate_cents`, `awarded_weekly_hours`; ECCE: `ecce_programme_year`, `higher_capitation`; `pps_number_encrypted` (reuse `lib/crypto`, never logged).
**Acceptance:**
- ≤1 ACTIVE ECCE and ≤1 ACTIVE NCS per child per overlapping period (constraint).
- PPSN encrypted at rest; excluded from logs/telemetry (assert in test).
- Award rate is entered (from CHICK), **not computed** — no means-test logic.
**Tests:** overlap constraint; encryption round-trip; PPSN never in audit payload; tenant isolation.
**Effort:** M.

## FEE-03 — Funding scheme config (effective-dated national rates) + tenant settings
**Goal:** hold ECCE capitation + NCS universal rates as versioned config; hold per-tenant toggles.
**Schema:** `funding_scheme_versions` (design §2.1: ECCE standard/higher weekly cents, hours caps 3/15/38; NCS universal `214`, hour caps 45/20, income-assessed ceiling for validation), `effective_from/to`, `source_ref`; `tenant_funding_settings` (ecce_enabled, ncs_enabled, higher_capitation_default, `subvention_billing_model`, term_calendar_id).
**Acceptance:**
- Platform-seeded with 2025/26 reference figures **flagged CONFIRM**; effective-dated, no overlap per scheme.
- Tenant read-only on national rates; can toggle enable/settings.
**Tests:** version selection by date; only-one-current per scheme.
**Effort:** S–M. **Blocked-by (data, not code):** Day-0 item 6 (SME rate confirmation).

## FEE-04 — Invoice + invoice-line ledger + state machine
**Goal:** the recurring-fee ledger the school portal never had.
**Schema:** `invoices` (school_id, child_id, payer_profile_id, period_start/end, `currency`, `gross_cents`, `subsidy_cents`, `discount_cents`, `net_cents`, `amount_paid_cents`, status enum `draft|due|partially_paid|paid|overdue|written_off|refunded|cancelled`, `due_date`, `subvention_calculation_id`, references, audit); `invoice_lines` (invoice_id, description, `hours`, `gross_cents`, `subsidy_cents`, `net_cents`, snapshot fields).
**Acceptance:**
- Explicit state machine (spec §8.6); transitions audited; **issued invoices immutable** (snapshot rates).
- Reuse `order_status`/`payment_status` patterns; new `invoice_status` enum.
- Historical invoices never rewritten on config change.
**Tests:** state transitions; immutability after issue; net = gross − subsidy − discount ≥ 0; tenant isolation.
**Effort:** L.

## FEE-05 — Subvention calculation engine (pure, heavily unit-tested) ⭐ core
**Goal:** the ECCE+NCS netting algorithm (design §3) as a pure, server-authoritative module in `lib/payments/subvention.ts` (mirrors `lib/payments/instalments.ts` style).
**Acceptance (the money rules):**
- ECCE zero-rates ≤3h/day, ≤15h/week, term-time only; accrues flat weekly capitation (NOT hourly) to provider receivable.
- NCS subsidises non-ECCE hours up to band; `subsidy = min(awardedRate×hours, feeForHours, gross)` → **net never negative**.
- Deterministic ordering ECCE→NCS→discount; rounding reconciles exactly (no orphan cents).
- Produces `SubventionCalculation` with full per-week snapshot.
**Tests (release-blocking):** worked example (design §3: €150 gross → €96.50 net, €69 ECCE + €53.50 NCS receivable); ECCE-only; NCS-only; stacked; non-term week; mid-week award start; suspended award; higher capitation; **property test**: net + subsidy sums exactly, no negative, no orphan cents.
**Effort:** L. **No external dependency — build in parallel with KYC/ComReg.**

## FEE-06 — Invoice generation (background job)
**Goal:** generate obligations/invoices ahead per `fee_schedules`, applying FEE-05.
**Acceptance:**
- Idempotent, retry-safe, tenant-scoped (reuse the job/webhook idempotency discipline from `payments`).
- Full-year projection: invoiced / paid / outstanding / next due (spec §8.5).
- Uses `basis=CONTRACTED` when billing ahead (see FEE-11 true-up).
**Tests:** re-run creates no duplicates; rate change respected by effective date; tenant isolation.
**Effort:** M.

## FEE-07 — Parent invoice view + transparent breakdown
**Goal:** the wedge — parent sees **"gross €X − NCS €Y − ECCE (free) = you pay €Z"**.
**Acceptance:**
- Statement + history (spec §8.5); breakdown line-itemised; simple UI controls.
- Parent sees only their linked child's invoices (reuse parent-scope guards).
**Tests:** parent authz (own children only); numbers match FEE-05; a11y.
**Effort:** M.

## FEE-08 — Pay a fee invoice in full (reuse Connect rail)
**Goal:** charge `invoices.net_cents` via the existing direct-charge path.
**Depends on:** P4 activation (Connect KYC) — **code reuses `lib/stripe/actions.ts` + Revolut**; sandbox first.
**Acceptance:**
- Creates an `order`/payment against the tenant's connected account (`stripeAccount`); webhook marks invoice paid idempotently; reconciled (`lib/reconciliation`).
- Refund/credit path reuses `lib/refunds` and allocates to the invoice ledger.
**Tests:** duplicate webhook can't double-post; refund updates ledger; tenant isolation of provider refs.
**Effort:** M (mostly wiring).

## FEE-09 — Instalments for fee invoices (reshape existing rules)
**Goal:** apply instalments to invoices with the crèche rules.
**Reshape `lib/payments/instalments.ts`:** `≥€20 fixed-4` → **`>€20`** (2000 excluded, 2001 eligible), **configurable 2/3/4**, tenant frequency (weekly/fortnightly/monthly) + first-payment date. Keep the exact-sum math.
**Acceptance:**
- €20.00 shows pay-in-full only; €20.01 offers full-vs-instalment radio (spec §8.4 / §12.1).
- Schedule sums exactly to invoice balance; partial payment → `partially_paid`; failed instalment → overdue + reminder, paid history intact; early payoff allowed.
**Tests:** the €20.00/€20.01 boundary; configurable counts sum exactly; failure/early-payoff; idempotency.
**Effort:** M.

## FEE-10 — Arrears reminders + outstanding-balance dashboard
**Goal:** automate the "magic wand" (spec §2.3) — no weekly manual chasing.
**Acceptance:**
- Reminders before due + after missed (reuse email/SMS + job idempotency); outstanding-fees management view (feeds DASH-01).
- Reminder job is idempotent/retry-safe; auditable.
**Tests:** reminder fires once per state; dashboard totals reconcile to ledger; tenant isolation.
**Effort:** M.

## FEE-11 — Attendance true-up + Pobal claim accrual ledger
**Goal:** reconcile contracted-billing against actual attendance (ADR-002) and track provider receivables.
**Depends on:** attendance (P2), FEE-05/06.
**Schema:** `pobal_claim_accruals` (design §2.4: school_id, child_id, week, scheme, hours, amount_cents, status `accrued|claimed|paid|queried`).
**Acceptance:**
- When a week's attendance finalises, recompute with `basis=ATTENDED` and post a credit/adjustment line (never rewrite the issued invoice).
- Accrual ledger supports the Hive-prep report (P6) and reconciliation against Pobal payments.
**Tests:** contracted vs attended delta produces correct adjustment; no double-adjust; tenant isolation.
**Effort:** M–L.

---

## Suggested build order
1. **FEE-05** (pure engine, no deps, no external blocker) + **FEE-03** (config) in parallel — start immediately.
2. **FEE-01 → FEE-02 → FEE-04** (schema spine).
3. **FEE-06 → FEE-07** (generate + show).
4. **FEE-09** (instalment reshape) → **FEE-08** (charge, when Connect sandbox ready).
5. **FEE-10 → FEE-11** (arrears, true-up).

**Critical-path note:** FEE-05 is the highest-risk/highest-value and has **zero external dependency** — code it first while Stripe/Revolut/Twilio KYC/registration (Day-0 items) mature. FEE-08 is the only ticket gated on external approval, and it's mostly wiring.
