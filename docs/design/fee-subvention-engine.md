# Fee + Subvention Engine — Data Model & Calculation Design

**Status:** Draft for review · **Owner:** First Stack Solutions · **Last updated:** 2026-09-16
**Scope:** The ECCE + NCS subvention layer that sits on top of the reused fee engine and produces the **net amount a parent actually pays** (what Stripe/Revolut charges) plus the **provider receivable from Pobal**.

> This is the highest-risk net-new component. It has **no reusable precedent** from the school portal. It has **no external dependency** (no Hive API, no KYC), so it is safe to build in parallel with the payment-provider long poles.

---

## 0. Non-negotiable design principles

1. **Money is integer minor units (euro cents).** Never floats. Currency = EUR for V1.
2. **All national rates are effective-dated configuration**, never hardcoded. Budget changes them yearly.
3. **We never re-implement the NCS means test.** Pobal computes the awarded hourly rate + band hours and issues them on the **CHICK award**. The provider enters those; we treat them as authoritative per child.
4. **Subvention is computed server-side** from attendance + funding registrations. Never trust amounts from the client.
5. **Issued invoices are immutable.** At issue time we **snapshot** every rate, band, scheme version and attendance basis used. A later config change never rewrites a historical invoice.
6. **Deterministic ordering of deductions:** ECCE (zero-rate specific hours) → NCS (subsidise remaining eligible hours up to band) → discounts → remainder is parent-payable. Net can never go below zero.
7. **Rounding reconciles exactly** — no orphan cents, no negative balances (same discipline as the instalment rule).

---

## 1. Who receives the money (the mental model)

Both subsidies are paid by **Pobal to the *provider***, not to the parent — but they affect the invoice differently:

| Scheme | Model | Effect on **parent invoice** | Effect on **provider income** |
|---|---|---|---|
| **ECCE** | Capitation (flat weekly per child) | The ECCE session hours are **not billed to the parent** (zero-rated) | Provider accrues **~€69.00/wk** (or **~€80.25** higher capitation), term-time |
| **NCS** | Hourly subsidy | Subsidy is **deducted** from the parent's gross charge for wraparound hours | Provider **claims** the same subsidy amount from Pobal |

```
Parent net payable   = gross fee (non-ECCE hours × provider rate)
                       − NCS subsidy (awarded rate × subsidised hours)
                       − discounts
                       (floored at 0)

Provider total income = parent net payable
                       + ECCE capitation (from Pobal)
                       + NCS subsidy claimed (from Pobal)
```

**Key correctness rule:** ECCE is *not* "provider rate × 15 hours" deducted from the parent — the ECCE sessions are simply **zero-rated**, and the provider receives the fixed capitation regardless of their commercial rate. Modelling ECCE as an hourly parent discount is the classic mistake.

---

## 2. Entities

### 2.1 Configuration (effective-dated, platform-seeded, tenant-viewable)

**`FundingSchemeVersion`** — national reference parameters, one row per (scheme, validity window).
```
id
scheme                enum: ECCE | NCS_UNIVERSAL          # income-assessed rate is per-child, not here
effective_from        date
effective_to          date | null      # null = current; no overlaps per scheme (exclusion constraint)
params                jsonb
  # ECCE:            capitation_standard_weekly_cents (6900), capitation_higher_weekly_cents (8025),
  #                  hours_per_day (3), days_per_week (5), hours_per_week (15), weeks_per_year (38)
  # NCS_UNIVERSAL:   hourly_rate_cents (214), max_hours_working (45), max_hours_not_working (20),
  #                  min_age_weeks (24), max_age_years (15),
  #                  income_assessed_max_hourly_rate_cents (510)   # for validation only
source_ref            text            # Pobal/Budget reference for audit
created_at, created_by
```
> Seeded and version-controlled by the platform, exposed read-only to tenants. Values above are **2025/26 reference figures — CONFIRM against the current Pobal circular before go-live.**

**`TenantFundingSettings`** — per-tenant toggles/overrides.
```
tenant_id, ecce_enabled, ncs_enabled, higher_capitation_default (bool),
subsidy_billing_model enum: RECONCILE_ON_ATTENDANCE | BILL_ON_CONTRACTED   # see §5
term_calendar_id, currency ('EUR')
```

**`ServiceCalendar`** — term weeks, closure days, bank holidays (drives ECCE term-time and the 10-closure-day rule).
```
id, tenant_id, programme_year,
operating_days (per week), ecce_term_weeks (date ranges),
subsidised_closure_days (date[]  max 10 per programme call — validated),
bank_holidays (date[])
```

### 2.2 Per-child funding registration (authoritative award data)

**`ChildFundingRegistration`**
```
id, tenant_id, child_id
scheme                enum: ECCE | NCS
status                enum: PENDING | ACTIVE | SUSPENDED | EXPIRED | CANCELLED
start_date, end_date

# NCS-specific:
chick_code            text            # Childcare Identifier Code Key
ncs_subsidy_type      enum: UNIVERSAL | INCOME_ASSESSED
awarded_hourly_rate_cents  int        # from the CHICK award — AUTHORITATIVE
awarded_weekly_hours       numeric    # band hours from the award (e.g. 45 or 20)

# ECCE-specific:
ecce_programme_year   text
higher_capitation     bool           # graduate-led room

# sensitive:
pps_number_encrypted  bytea | null   # PPSN — treat as special-category, encrypt at rest, never log
audit fields
```
**Constraints:** at most one ACTIVE ECCE and one ACTIVE NCS registration per child per overlapping period; `awarded_hourly_rate_cents ≤ income_assessed_max_hourly_rate_cents` (validation warning, not hard block — rates can rise).

### 2.3 Fee basis (extends reused fee engine)

**`ChildBooking`** — contracted weekly attendance pattern (effective-dated).
```
id, tenant_id, child_id, effective_from, effective_to,
weekly_pattern: [ { weekday, session_id, start_time, end_time, is_ecce_session (bool) } ]
# derived: contracted_hours_per_week, ecce_hours_per_week
```
**`ServiceRate`** — provider's commercial rate (per service/room/age band), effective-dated: `hourly_rate_cents` (canonical) plus optional session/day/week display rates.

### 2.4 Outputs (auditable, immutable at issue)

**`SubventionCalculation`** — the computed result for a (child, billing period). One per calc run; the issued one is frozen.
```
id, tenant_id, child_id, period_start, period_end,
basis enum: CONTRACTED | ATTENDED,
gross_parent_cents, ecce_zero_rated_hours, ecce_capitation_accrued_cents,
ncs_subsidised_hours, ncs_subsidy_cents, discount_cents,
net_parent_payable_cents,
provider_receivable_ecce_cents, provider_receivable_ncs_cents,
snapshot jsonb   # scheme_version_ids, awarded rates, band, calendar id, per-week breakdown
created_at
```
**`Invoice` / `InvoiceLine`** (reused) — each line carries `hours`, `gross_cents`, `subsidy_cents`, `net_cents`. Invoice links its `SubventionCalculation` snapshot.

**`PobalClaimAccrual`** — provider receivable ledger for reconciliation against what Pobal actually pays.
```
id, tenant_id, child_id, week, scheme, hours, amount_cents, status (ACCRUED | CLAIMED | PAID | QUERIED)
```

---

## 3. The calculation algorithm

Operates per **child per billing period**, week by week (NCS and ECCE are weekly concepts).

```text
computeChildInvoice(child, period, basis):        # basis = CONTRACTED | ATTENDED
  cfg   = snapshot(FundingSchemeVersion effective across period)
  cal   = ServiceCalendar(tenant, period)
  regs  = activeFundingRegistrations(child, period)     # ecce?, ncs?
  rate  = ServiceRate(child, period)                    # provider hourly_rate_cents
  hours = basis == ATTENDED ? attendance(child, period) # actual hours/day
                            : contracted(child, period)  # from ChildBooking

  totals = { grossParent:0, ncsSubsidy:0, ecceCapitation:0,
             ecceHours:0, ncsHours:0 }
  weekLines = []

  for each operating week W in period:
     if not cal.isOperating(W): continue
     dayHours = hoursByDay(hours, W)                     # {Mon:.., Tue:..}

     # ---- 1. ECCE: zero-rate up to 3h/day, 15h/week, term-time only ----
     ecceHoursW = 0
     if regs.ecce.activeIn(W) and cal.isEcceTermWeek(W):
        for each operating day D in W:
           take = min(dayHours[D], cfg.ecce.hours_per_day)      # cap 3h/day
           ecceHoursW += take;  dayHours[D] -= take             # remove from billable
        ecceHoursW = min(ecceHoursW, cfg.ecce.hours_per_week)   # cap 15h/week
        cap = regs.ecce.higher_capitation ? cfg.ecce.capitation_higher_weekly_cents
                                          : cfg.ecce.capitation_standard_weekly_cents
        totals.ecceCapitation += cap                            # flat weekly, NOT hourly
        totals.ecceHours      += ecceHoursW
        # NOTE: no parent charge for ECCE hours

     # ---- 2. Remaining hours billed to parent at provider rate ----
     billableHoursW = sum(dayHours)
     grossW = round(rate.hourly_rate_cents * billableHoursW)     # integer cents

     # ---- 3. NCS subsidy on remaining hours, up to band ----
     ncsW = 0; ncsHoursW = 0
     if regs.ncs.activeIn(W) and regs.ncs.status == ACTIVE:
        ncsHoursW = min(billableHoursW, regs.ncs.awarded_weekly_hours)   # band cap
        raw       = round(regs.ncs.awarded_hourly_rate_cents * ncsHoursW)
        # CONFIRM rule: subsidy may not exceed the actual fee for those hours (no profit)
        feeForSubsidisedHours = round(rate.hourly_rate_cents * ncsHoursW)
        ncsW      = min(raw, feeForSubsidisedHours, grossW)              # never negative net
        totals.ncsSubsidy += ncsW;  totals.ncsHours += ncsHoursW

     netW = grossW - ncsW                                        # >= 0
     totals.grossParent += grossW
     weekLines.push({ W, billableHoursW, grossW, ncsW, netW, ecceHoursW })

  # ---- 4. discounts / other funding (invoice level) ----
  discount = applyDiscounts(child, period, totals.grossParent - totals.ncsSubsidy)

  net = max(0, totals.grossParent - totals.ncsSubsidy - discount)

  # ---- 5. reconcile rounding across weeks so lines sum exactly to net ----
  reconcileCents(weekLines, net)

  return SubventionCalculation{
    gross: totals.grossParent, ncsSubsidy: totals.ncsSubsidy,
    ecceCapitation: totals.ecceCapitation, net,
    providerReceivable: { ecce: totals.ecceCapitation, ncs: totals.ncsSubsidy },
    snapshot: { cfg.ids, regs.rates, cal.id, weekLines }
  }
```

### Worked example (illustrative, using reference rates — CONFIRM)
Child, 3yo, provider rate **€6.00/hr**, attends **40 hrs/week**, term-time. ECCE registered; NCS universal award **€2.14/hr, band 45 hrs**.
- ECCE: 3h/day × 5 = **15h zero-rated** → capitation **€69.00/wk to provider**; parent not charged for these 15h.
- Billable to parent: 40 − 15 = **25h** → gross **€150.00**.
- NCS: min(25, 45) = 25h × €2.14 = **€53.50 subsidy** (≤ €150 fee ✓).
- **Parent net = €150.00 − €53.50 = €96.50/wk.**
- **Provider income = €96.50 (parent) + €69.00 (ECCE) + €53.50 (NCS) = €219.00/wk.**

---

## 4. Business rules to encode

- ECCE per-day cap **3h**, weekly **15h**, **term-time (≈38 wks)** only; outside term, all hours are billable/NCS-eligible.
- NCS subsidy applies only to **non-ECCE** hours (wraparound), up to **band hours** (post-May-2022: ECCE hours are **not** deducted from the NCS band).
- Subsidy **capped** so net ≥ 0 and (CONFIRM) not exceeding actual fee per hour.
- **Award lifecycle:** mid-period start/end pro-rates by week; `SUSPENDED` (e.g. 4-week absence) → no subsidy from suspension date; `EXPIRED` → falls back to full parent rate.
- **Rate change mid-period:** effective-dated config means each week uses the version valid that week.
- **Closure days / bank holidays:** funded up to **10 subsidised closure days** per programme call (validate the cap); parent billing during closures follows tenant policy.
- **Higher capitation** only if the room qualifies (graduate lead) — flag per registration.

---

## 5. The one big open decision: bill-in-advance vs reconcile-on-attendance

The reused fee engine bills **ahead** (annual/term schedules). NCS pays on **actual attendance**, reconciled via the weekly return. Two models:

- **A — `BILL_ON_CONTRACTED` (recommended default):** invoice the parent the *expected* net using contracted hours, then **true-up** with a credit/adjustment when the week's attendance return is finalised. Keeps cash flow predictable; matches how providers actually operate. Needs a subsidy-accrual ledger + adjustment lines.
- **B — `RECONCILE_ON_ATTENDANCE`:** invoice only after attendance is known. Simpler correctness, worse cash flow, more billing lag.

Make it a **tenant setting** (`subvention_billing_model`), default **A**, and record the choice in an ADR. This decision drives whether `SubventionCalculation.basis` is CONTRACTED (with later ATTENDED true-up) or ATTENDED-only.

---

## 6. Testing (release-blocking — this is money for children)

- Unit: the €20.00/€20.01 instalment boundary; ECCE 3h/15h caps; NCS band cap; subsidy-≤-fee cap; net-never-negative; rounding sums exactly.
- Property test: for random hours/rates/awards, `net + ncsSubsidy + (ecce zero-rated value) == gross` and no orphan cents.
- Scenario: ECCE-only; NCS-only; ECCE+NCS stacked; non-term week; mid-week award start; suspended award; rate change mid-month; higher capitation.
- Snapshot/immutability: config change after issue does not alter a historical invoice.
- Tenant isolation: Tenant A cannot read Tenant B CHICK/award/PPSN or subvention calcs.

---

## 7. Items to CONFIRM with a Pobal/finance SME before coding go-live
1. Exact **ECCE capitation** figures (standard/higher) and **NCS universal** rate for the current programme year.
2. Whether **NCS subsidy is capped at the actual hourly fee** (no-profit rule) and the precise formula.
3. Current **hour-partition** rules where ECCE + NCS overlap on the same day.
4. Precise **closure-day / absence / under-attendance** thresholds (10 days; 4-week absence; 8+4-week under-attendance) as they stand this programme call.
5. Income-assessed **rate ceiling** used only for entry validation.
