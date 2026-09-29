# Flexible Onboarding: Config Toggles + Custom Fields

**Status:** Design + tickets · **Date:** 2026-09-16
**Origin:** manager wants onboarding to work "both ways" — a standard upload now, plus the ability to
add extra fields (dropdowns/radios) on the fly that aren't in the original spreadsheet.
**Related:** [onboarding-template-headers.md](../onboarding/onboarding-template-headers.md), `tenant_funding_settings` (mig 068), import wizard (IMP-01), [fee-subvention-engine.md](fee-subvention-engine.md).

## Principle: three layers, not one "dynamic schema"

Splitting "flexible" into three layers gives the manager everything asked for without the EAV swamp
(unqueryable, hard to validate, a tenant-isolation risk) that would erode the clean UX and NCS correctness.

| Layer | What | How | Risk |
|---|---|---|---|
| **1. Standard fields** | Known typed columns (child, fee, NCS CHICK, room, ratio…) | Real DB columns; power fees/NCS/attendance/compliance | none — already designed |
| **2. Config toggles** | The finite "both ways" choices (the 4 questions) | Explicit per-tenant settings, chosen by **radio/dropdown** | low |
| **3. Custom fields** | Extra tenant-defined fields, incl. created during import, **promotable into system logic** | `custom_field_definitions` + JSONB values on the core row + promotion | contained (see promotion) |

---

## Layer 2 — Config toggles (the 4 questions, answerable both ways)

Extend `tenant_funding_settings` (mig 068) + a small `tenant_onboarding_settings`. Manager picks in a
simple settings screen; the import wizard and forms adapt.

| Question | Setting | Options (radio/dropdown) | Default |
|---|---|---|---|
| Fees vary by session type within a room? | `fee_model` | `FLAT_PER_CHILD` / `PER_SESSION_TYPE` | FLAT_PER_CHILD |
| Gross fee recorded before or after subsidy? | `gross_fee_basis` | `BEFORE_SUBSIDY` / `AFTER_SUBSIDY` | BEFORE_SUBSIDY |
| Track deposits / registration fees? | `deposits_enabled` | `Yes` / `No` | No |
| (billing timing — ADR-002) | `subvention_billing_model` | `BILL_ON_CONTRACTED` / `RECONCILE_ON_ATTENDANCE` | BILL_ON_CONTRACTED |

- **Standard-first:** every tenant can onboard on the defaults immediately; toggles are optional refinements.
- `PER_SESSION_TYPE` unlocks multiple fee rows per child (Fees & Funding sheet keyed by child + session type).
- `AFTER_SUBSIDY` tells the importer the sheet's amount is already netted, so the engine back-computes gross.

---

## Layer 3 — Custom fields (add-on-the-fly)

**`custom_field_definitions`** (tenant-scoped):
```
id, school_id, entity ('child'|'parent'|'staff'|'room'|'enrolment'|'waiting_list'),
key (slug), label, field_type ('text'|'number'|'date'|'dropdown'|'radio'|'checkbox'|'multiselect'),
options JSONB (for dropdown/radio/multiselect), required BOOLEAN, sort_order,
affects_billing BOOLEAN DEFAULT FALSE,   -- the guardrail switch (see below)
created_at, created_by
```
- **Values live in a `custom_fields JSONB` column on each core table** (child, parent, …) — not a separate
  values table. Postgres keeps this queryable; because the value sits on the tenant-scoped row, existing
  RLS/tenant-scoping already covers it (no new isolation surface).
- Validation is driven by the definition (type + options), applied identically in forms and import.
- **Cap** custom fields per entity (e.g. 30) to protect UX/performance.

### Promotion: custom fields become first-class (the manager's requirement)
A custom field is **not** permanently walled off. It starts as record-keeping (fast to add, zero risk), and
can then be **promoted** to participate in one or more system capacities. Promotion is an explicit, audited
action that attaches a **type contract + validation** to the field so downstream logic can trust it.

`custom_field_definitions` carries a `promoted_to JSONB` set of targets:

| Promotion target | What the field starts doing | Type it must satisfy |
|---|---|---|
| `billing` | Feeds the fee engine / subvention (e.g. a per-child surcharge, a discount) | numeric or enum, required, validated |
| `dashboard` | Appears as a metric/aggregation on the commercial dashboard | numeric / enum / date |
| `reporting` | Available as a report column + export | any typed |
| `filter` | A segment/recipient filter (messaging, lists) | enum / dropdown / boolean |
| `messaging` | A merge-tag in email/SMS templates (`{{child.bus_route}}`) | text / enum / date |
| `compliance` | Drives expiry reminders / inspection export | date (for expiry) / enum |
| `attendance` / `rooms` | Participates in room/attendance logic where relevant | typed per use |

**The one rule kept (not a wall, a contract):** anything that touches **money, NCS/ECCE or compliance** may
only consume a field that has been **promoted with a validated type** — never raw free-text JSON. Promotion
is what turns an untyped note into a trustworthy input. For heavy billing use, promotion can optionally
**materialise the field to a real core column** (auto-generated migration) so it's fully first-class and
auditable; the JSONB value backfills into it. Either way the fee engine only ever reads typed, validated data.

**No redundancy:** on create/import the system detects near-duplicates of existing core or custom fields
("looks like *Date of Birth* — map to the existing field?") and offers **map/merge** instead of creating a
new one. Promotion can also **merge** a custom field into a core field, migrating its values.

**Sensitive data:** PPSN/health still must use the protected core fields (encryption, no-logging); the
custom-field UI blocks obvious sensitive keys and refuses to promote them into general logs.

### Import-wizard integration (the "create field on the fly")
In the mapping step, each spreadsheet column maps to: **(a)** a standard field, **(b)** an existing custom
field, **(c)** "Create new custom field" → pick type (dropdown/radio/text/number/date) + options, or
**(d)** ignore. New definitions are created before the dry-run so values validate on import. This is exactly
"extra fields not in the original upload, created dynamically."

---

## Phasing
1. **Now (Layer 1 + 2):** standard template + config-toggle settings screen. Angels Nest onboards on defaults.
2. **Next (Layer 3):** `custom_field_definitions` + JSONB values + forms rendering + import "create field" flow.
3. **Then (promotion):** promote fields into billing/dashboard/reporting/filter/messaging/compliance targets,
   with typed validation and optional materialise-to-core; near-duplicate detection + map/merge.
4. **Deliberately never:** money/NCS/compliance logic reading **unvalidated** free-text JSON. Promotion (with a
   type contract) is the supported path to make a custom field feed those functions.

## Tickets
- **CFG-01** — `tenant_onboarding_settings` + settings UI (radio/dropdown for the 4 toggles); wizard/forms read them. *(Layer 2)*
- **CF-01** — `custom_field_definitions` (incl. `promoted_to`) + `custom_fields JSONB` on core tables + grants/RLS. *(Layer 3)*
- **CF-02** — Dynamic form renderer (render/validate custom fields by type) for admin create/edit screens.
- **CF-03** — Import-wizard mapping: map-to-custom + "create new custom field" + near-duplicate detection (map/merge); validate in dry-run.
- **CF-04** — **Promotion engine:** attach type contract + validation, wire a promoted field into its targets, audit the change.
- **CF-05** — Optional **materialise-to-core**: auto-generate a migration + backfill JSONB values into a real column for heavy billing/compliance use.

## Decision (resolved)
- Custom fields **are promotable into system logic** (manager's requirement). Promotion attaches a validated
  type so money/NCS/compliance stay auditable; the only thing disallowed is *unvalidated* JSON feeding those
  functions. Near-duplicate detection prevents redundant fields.
