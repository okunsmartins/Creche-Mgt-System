# School Collection Service + Authorised Collectors — Design & Plan

**Status:** Draft for review · **Owner:** First Stack Solutions · **Date:** 2026-10-02
**Related:** [fee-subvention-engine.md](fee-subvention-engine.md), [reuse-map.md](reuse-map.md),
[implementation-status.md](../implementation-status.md), [onboarding-template-headers.md](../onboarding/onboarding-template-headers.md)
(the onboarding workbook already anticipates an *Authorised Collectors* sheet).

> Two related features requested 2026-10-02. **Feature B (Authorised Collectors)** is foundational and a Tusla
> compliance requirement; **Feature A (School Collection Service)** is the "we collect your child from their
> primary school" offering and is built on top of B. Both reuse existing modules — neither is from scratch.

---

## 1. Why these exist (the Irish operational model)

Many crèches run **after-school care with school collection** (a Tusla-registered *School-Age Childcare* / SAC
service) alongside their baby/toddler/preschool rooms. A crèche collects primary-school children (Junior Infants–6th
class) from their school and minds them — snack/meal, homework, activities — until a parent collects, typically by
~6:15–6:30pm. The common case for our users: **one parent collects the toddler *and* the older sibling from the same
premises.**

Collection is done by a **walking bus**, a **minibus**, or a **vetted minder at the school gate**; collectors are
**Garda-vetted staff** and a typical **chaperone-to-child ratio is 1:4**. Charging is **per-day, weekly, or
per-term** depending on the crèche, and school-age children qualify for **NCS** subsidy.

### Regulatory grounding (Tusla School-Age Childcare regulations)
- Every service must document, in its policies / Child Safeguarding Statement, its **drop-off and collection
  practices**, including **who is authorised to collect each child** and **whether a child may leave unaccompanied**.
- **Written parental consent** is required for the collection arrangement.

→ This makes **Feature B a compliance requirement in its own right**, and **Feature A's consent capture mandatory**.
Sources recorded in the research note of this feature's originating session (Citizens Information; Tusla School-Age
Services FAQ; Headstart; Links Childcare; Múin).

---

## 2. Decisions captured (from product owner, 2026-10-02)

| Question | Decision |
|---|---|
| Feature A charge basis | **All three** — per-day, weekly, per-term — offered as a **dropdown, configurable per crèche**. |
| Collection method | **Configurable dropdown per crèche** (e.g. minibus / walking bus / gate collection / parent-arranged), and we **model the transport** (capacity + assigned staff). |
| Who proposes collectors (Feature B) | **Both** — parents (with crèche approval) **and** staff. |
| Deliverable now | **This plan doc** (no build yet). |

---

## 3. Conventions (inherited project rules — apply to every ticket)
- New tables use **`school_id`** (matches current schema; renamed with the P1 domain rename). Child FKs reference
  `students(id)` (→ `children` after rename).
- **Server-side authz + `school_id` scoping on every query** (service-role client bypasses RLS), **RLS + explicit
  grants** on each new table, and a **cross-tenant negative test in the same PR** (release-blocking).
- Money is integer **`*_cents`**, `currency DEFAULT 'EUR'`; status fields are **TEXT + CHECK** (or enums) with
  `set_updated_at` triggers; financial ops idempotent + audited.
- No new unvalidated free-text feeding money/compliance logic.

---

## 4. Feature B — Authorised Collectors (build first)

A per-child register of people approved to collect the child, with crèche approval and a check-out handover record.
Foundational for Feature A and a standalone compliance win.

### 4.1 Data model — migration `078_authorised_collectors.sql`
`authorised_collectors`
- `id` uuid pk · `school_id` uuid (FK schools) · `student_id` uuid (FK students)
- `full_name` text · `relationship` text (parent / guardian / grandparent / aunt-uncle / childminder / other)
- `phone` text (E.164) · `photo_path` text null (storage ref, for door ID)
- `collection_password` text null (**hashed**, not plaintext — spoken word/PIN verified at handover)
- `can_collect_unaccompanied` boolean default false (for older school-age children only)
- `status` text CHECK in (`pending`,`approved`,`declined`,`revoked`) default `pending`
- `proposed_by` text CHECK in (`parent`,`staff`) · `proposed_by_profile_id` uuid · `reviewed_by_profile_id` uuid null
- `notes` text null · `is_active` boolean default true · `created_at` / `updated_at`
- **Partial-unique** guard optional: one active row per (student_id, full_name, phone).

Optional companion `collection_events` (handover log) — can live here or be folded into the daily check-out record
(see §4.3): `id` · `school_id` · `student_id` · `collector_id` (FK authorised_collectors, nullable for ad-hoc) ·
`collected_at` · `released_by_profile_id` (staff) · `method` (`parent_pickup`/`authorised_collector`) · `notes`.

Grants: `service_role` full; `authenticated` SELECT only where needed (prefer service-role reads). RLS deny-by-default.
⚠️ `collection_password` is sensitive → **hash it** (reuse `src/lib/crypto`), never return it to the client.

### 4.2 Flows (reuse the link-request approve/reject pattern)
- **Parent proposes:** parent portal → "Who can collect {child}" → add collector (name, relationship, phone, photo,
  optional password) → `status=pending`, `proposed_by=parent`.
- **Staff propose/add:** admin → child record → Authorised Collectors → add (can be auto-approved by an admin, or
  left pending for a second reviewer, per crèche preference).
- **Crèche approves/declines:** admin reviews pending collectors (mirrors `/admin/link-requests`), sets
  `approved`/`declined`; `revalidatePath` the child + list pages (known stale-RSC gotcha).
- **At check-out:** the daily check-out screen shows the child's **approved** collectors (photo + name) so staff can
  verify the person and record *who* collected (→ `collection_events` / check-out record).

### 4.3 Reuse
- Approve/decline flow: **link-requests** pattern. · Photo upload: **documents/assignments** upload. ·
  Check-out handover: **daily check-in/out** (`src/lib/checkin/*`, mig 073) — add `released_to_collector_id` to the
  check-out, or write a `collection_events` row. · Crypto: `src/lib/crypto` for the password hash.

### 4.4 Tickets
- **COL-01** migration 078 + grants/RLS + cross-tenant test.
- **COL-02** pure lib `src/lib/collectors/collectors.ts` (validation, status machine, password hash/verify) + unit tests.
- **COL-03** admin UI `/admin/children/[id]` Authorised Collectors panel + approve/decline actions.
- **COL-04** parent UI "Who can collect my child" (propose + see status).
- **COL-05** wire approved-collector display + handover record into daily check-out.

---

## 5. Feature A — School Collection Service (built on B)

A recurring, billable service with a **logistics layer** (which school, which days, by what method, with capacity +
staff) and a **consent + charging layer**.

### 5.1 Data model — migration `079_school_collection.sql`

**Per-crèche config** (dropdown sources, so each crèche controls its own options):
- `collection_methods` (tenant-config): `id` · `school_id` · `label` (e.g. "Minibus", "Walking bus", "Gate
  collection", "Parent-arranged") · `has_transport` boolean · `display_order` · `is_active`.
- Charge basis is an enum used on the run: `charge_basis` ∈ (`per_day`,`weekly`,`per_term`) — the **dropdown** offered
  to the crèche when pricing a run (all three available; crèche picks per run).

**The school run / route** `collection_runs`
- `id` · `school_id` · `name` · `origin_school_name` text (the primary school children are collected from)
- `collection_method_id` (FK collection_methods) · `days_of_week` (e.g. int[] or 7 bool cols) · `pickup_time` time
- `capacity` int (enforce the **1:4 ratio** → required staff = ceil(children/4)) · `assigned_staff_ids` (via join)
- `charge_basis` text CHECK (`per_day`,`weekly`,`per_term`) · `price_cents` int · `is_active`
- (reuse the ratio engine `src/lib/ratios/ratio.ts` to flag under-staffed runs.)

**Per-child enrolment** `collection_enrolments`
- `id` · `school_id` · `student_id` · `collection_run_id` · `days` (which of the run's days this child needs)
- `start_date` / `end_date` null · `status` text CHECK (`requested`,`approved`,`declined`,`active`,`ended`)
- `consent_slip_id` uuid null (link to the permission-slips consent record) · `requested_by` (`parent`/`staff`)
- `created_at`/`updated_at`. **Partial-unique**: one active enrolment per (student, run).

Grants/RLS/cross-tenant test as §3.

### 5.2 Flows
- **Crèche sets up a run:** admin → Collection → New run → pick **collection method** (dropdown from
  `collection_methods`), origin school, days, pickup time, capacity, assign vetted staff, set **charge basis
  (dropdown)** + price. Ratio engine warns if capacity exceeds staff×4.
- **Parent requests collection** (or staff enrol on their behalf): choose run + days → `status=requested`.
- **Crèche consents:** admin approves/declines (link-request pattern); on approve, generate/attach a
  **consent slip** (permission-slips module) for the parent to sign, and create the **charge** (fee engine).
- **Charging:** per the run's `charge_basis` → feed the **fee/invoice engine** (`src/lib/fees/*`, mig 071) as a
  recurring billable; **NCS school-age subvention netted** by `src/lib/payments/subvention.ts`; parent pays once
  Stripe/Revolut is live (per-tenant resolvers — see implementation-status "Per-tenant payments").
- **Daily collection register:** on a run day, staff mark each enrolled child **"collected from school → arrived"**,
  then later **"released to {authorised collector}"** (Feature B) — all on the daily check-in/out surface.

### 5.3 Reuse
- Recurring billable enrolment: **activities/programmes** (`/admin/programmes`). · Consent: **permission-slips**. ·
  Charging + NCS: **fee engine + subvention** (migs 071, `lib/fees`, `lib/payments/subvention`). · Ratios:
  `lib/ratios/ratio.ts`. · Register/handover: **daily check-in/out** + **Feature B**. · Approve/decline: link-requests.

### 5.4 Tickets
- **SCH-01** migration 079 (collection_methods config, collection_runs, collection_enrolments) + grants/RLS + xtenant test.
- **SCH-02** pure lib `src/lib/collection/*` (run capacity vs ratio, charge computation per basis, status machines) + tests.
- **SCH-03** admin: collection-method config + run CRUD (with method & charge-basis dropdowns, ratio warnings).
- **SCH-04** request → consent (permission-slip) → approve → charge (fee engine) pipeline.
- **SCH-05** daily collection register (collected-from-school → released-to-collector), on the check-in/out surface.
- **SCH-06** parent UI: request collection, view schedule, consent, invoices.
- **SCH-07** (payment-gated) parent pays collection charges once Stripe/Revolut active — plugs into existing rails.

---

## 6. Sequencing

1. **Feature B (COL-01…05)** — self-contained, compliance win, **no payment dependency**, buildable now. Underpins A.
2. **Feature A non-payment (SCH-01…06)** — scheduling, consent, charging *computation*, collection register — all
   buildable now on the existing fee/NCS engine.
3. **Feature A payment (SCH-07)** — flips on with the per-tenant Stripe/Revolut activation already in the go-live plan.

Everything here is **net-new but has no external dependency** (no KYC/ComReg), so it can be built in parallel with the
payment-provider long poles — same principle as the fee engine.

---

## 7. Open questions (to resolve before SCH-02/SCH-04 build)
- **NCS school-age nuance:** confirm the NCS rate/band handling for school-age (wraparound) hours differs from
  preschool — validate constants with the Pobal/finance SME (same `CONFIRM` discipline as the subvention engine).
- **Transport liability/insurance fields:** do crèches need to record vehicle reg / insurance / driver on a run, or
  is "method + assigned staff" enough for V1? (Leaning V1 = method + staff; add vehicle metadata later.)
- **Unaccompanied release:** for older children allowed to leave alone, is a per-day parent confirmation needed, or
  a standing consent on the authorised-collector record? (Default: standing `can_collect_unaccompanied` flag + audit.)
- **Charge timing:** invoice per-term up front, or accrue per attended day (ties to FEE-11 attendance true-up)?
