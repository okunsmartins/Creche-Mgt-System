# Competitor Analysis — Aladdin (and the payments specialists) vs School Demo

**Date:** 2026-06-22 · Companion to `docs/market-validation.md`. Desk research; figures are point-in-time and anecdotal where noted.

---

## 1. Aladdin profile (quantified)

| Metric | Value |
|---|---|
| Schools | 2,900+ (~90% of Irish primary) |
| Pupils / staff | 500,000+ pupils · 30,000+ staff daily |
| Track record | 15+ years; data hosted in Ireland (GDPR) |
| iOS app rating | **3.5 / 5 from ~25 ratings** (weak satisfaction for a dominant app) |
| Pricing | **Not published** — sales-led quotes only |

Modules: **Start** (attendance roll books, student/family info, standardised test tracking, NCCA end-of-year reports) · **Connect** (messaging, absence notes, permission slips, parent-teacher meeting scheduler, online enrolment) · **Frame** (photos, galleries, portfolios). Add-ons: **ePayments**, **Library**, **Staff Absences**. Sources: [aladdin.ie](https://www.aladdin.ie/), [parents](https://www.aladdin.ie/parents.html), [packages](https://www.aladdin.ie/packages.html).

**Key insight:** dominance comes from school-level lock-in (full MIS + Tusla returns), not product love — a 3.5★ app with recurring UX complaints is the opening.

---

## 2. Feature matrix — Aladdin vs School Demo

| Capability | Aladdin | School Demo |
|---|---|---|
| Online card payments | ✅ ePayments | ✅ Stripe |
| Pay without account (guest) | ❌ login/app | ✅ guest by pupil code |
| Instalments / deposits | ⚠️ limited | ✅ |
| Admin payment links | ❌ | ✅ token links |
| Activities (one-off) + Programmes (recurring) | ⚠️ fees only | ✅ both + enrolment |
| Refunds / reconciliation / CSV | ⚠️ partial | ✅ |
| Daily attendance roll | ✅ mature (Leabhar Tinrimh, OLCS) | ✅ present/late/absent + notes |
| **Tusla SAR/AAR returns** | ✅ generates | ❌ data only (see §5) |
| Attendance analytics | ✅ trends | ✅ per-pupil %, weekly/monthly charts |
| Messaging / noticeboard / calendar | ✅ | ❌ |
| Permission slips / PT booking / enrolment forms | ✅ | ❌ |
| Native mobile apps + push | ✅ (buggy) | ❌ responsive web |
| Full MIS (test results, NCCA reports, library, staff absences, photos) | ✅ | ❌ |
| Modern UX polish | ⚠️ dated | ✅ |
| Track record / trust | ✅ 2,900 schools | ❌ POC |

---

## 3. Aladdin complaints → School Demo openings

| Aladdin complaint (sourced) | Opening |
|---|---|
| Notifications broken even with settings on | Reliable email + push |
| **3-minute payment timeout** breaks bank-app approval | Frictionless Stripe checkout |
| No "pay as guest" (must log in) | Guest pay (but see §4 caveat) |
| Communication fragmented (email + 2 apps) | Consolidation (needs messaging) |
| "Dreadful" app & website; copy/paste removed; keyboard glitches | Modern, fast, accessible UX |
| Unresponsive to feature requests | Nimbleness |
| No public pricing | Transparent pricing |

Sources: [App Store reviews](https://apps.apple.com/ie/app/aladdin-schools-connect/id1314919034?see-all=reviews).

---

## 4. Payments-specific scorecard (the crowded field)

Aladdin is the MIS incumbent, but the **payments specialists** are the real competitors if School Demo positions as "payments." Critically, **guest pay is NOT unique against them** — it's table stakes here.

| Capability | Aladdin | Way2Pay (BOI) | Easy Payments Plus / Payzone | School Demo |
|---|---|---|---|---|
| Online card payments | ✅ | ✅ | ✅ | ✅ (Stripe) |
| **Guest / no-account pay** | ❌ | ✅ "Make a Payment" | ✅ guest checkout | ✅ |
| In-store / cash option | ❌ | ⚠️ | ✅ 3,500 Payzone shops | ❌ online only |
| Instalments / deposits | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Recurring programmes + enrolment | ❌ | ❌ | ⚠️ products | ✅ |
| Reconciliation / reports | ✅ | ✅ | ✅ by class/activity | ✅ + CSV |
| Next-day settlement | ⚠️ | ✅ (BOIPA) | ✅ | ⚠️ Stripe payout schedule |
| **OGP framework approved** | n/a | ✅ | ✅ | ❌ (barrier) |
| SMS/email to parents | ✅ | ✅ | ✅ | ⚠️ email only |
| **Attendance + per-pupil analytics** | ✅ | ❌ | ❌ | ✅ |
| Modern UX | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Track record | ✅ | ~466 schools | large (framework) | ❌ POC |

Sources: [way2pay.org](https://www.way2pay.org/), [payzone.ie/school-payments](https://www.payzone.ie/school-payments).

**Honest correction to the earlier analysis:** "pay as guest" differentiates School Demo vs **Aladdin**, but **not** vs the payment specialists (Way2Pay and Payzone/EPP both offer it). Competing as "just better payments" is very hard: the field is crowded, framework-gated (OGP), and the specialists have settlement banking relationships, SMS, and in-store cash that School Demo lacks.

**School Demo's only genuinely differentiated cell across ALL players:** the **combined payments + teacher attendance + per-pupil attendance analytics** in one modern tool. The specialists are payments-only; Aladdin has both but clunky. That combination — not guest pay, not "nicer payments" — is the realistic wedge.

---

## 5. Tusla SAR — requirements and the data gap

To "do Tusla returns" (the thing that makes attendance *statutory*, not just nice charts):

- **SAR (Student Absence Report):** pupils with **20+ days** absence, submitted **twice yearly** (Period 1 Sept–Christmas → Jan; Period 2 Christmas–year-end → after summer close).
- **AAR (Annual Attendance Report):** within **6 weeks** of year-end.
- **Mandatory fields per pupil:** class, **PPSN**, name, **gender**, **DOB**, plus absence data. Submitted via the Tusla Portal (manual entry or upload).
- Sources: [Tusla reporting](https://www.tusla.ie/tess/tess-ews/reporting-absenteeism/), [submission guide](https://www.tusla.ie/services/educational-welfare-services/information-for-schools-inc-absence-reporting/reporting-absenteeism/guide-to-submitting-school-absence-returns-online/).

**⚠️ Concrete gap:** School Demo's `students` table holds `first_name, last_name, class_id, pupil_payment_code` — it does **not** store **PPSN, gender, or DOB**. Generating a SAR therefore requires:
1. Adding PPSN/gender/DOB columns (PPSN is highly sensitive PII → DPIA, encryption-at-rest consideration, strict RLS, retention policy).
2. Computing 20-day thresholds over the school year from `attendance_records`.
3. A SAR export in Tusla's expected format.

This is **not a quick win** (it's the Phase 4 / compliance track) and it raises the data-sensitivity profile significantly. Aladdin already holds these as a full MIS — part of why it owns this job.

---

## 6. Build plan — Tier 1 improvements (lean into the wins)

Where School Demo already beats incumbents; cheap and high-leverage.

| # | Item | What | Effort | Notes |
|---|---|---|---|---|
| 1 | **Headline guest pay + frictionless checkout** | Multi-child / multi-item single checkout (basket route exists at `guest-payment/basket` — extend it), save-card for repeat payers, no session-timeout trap (Stripe Checkout already avoids the 3-min issue). Market it on the homepage. | ~1–2 wks | Directly attacks Aladdin's #1 payment complaint |
| 2 | **Transparent pricing page** | Public `/pricing` route with clear per-school / per-transaction model. | ~0.5 day | Differentiator vs all (none publish pricing) |
| 3 | **Lead with the combined wedge** | Reframe marketing: "payments **+** attendance **+** Tusla-ready reporting in one modern tool" — the one cell no competitor matches. | copy only | The actual defensible position |

## 7. Build plan — Tier 2 (close the gaps that lose deals)

| # | Item | Effort | Caveat |
|---|---|---|---|
| 4 | **Tusla SAR generation** | ~2–3 wks | Requires PPSN/gender/DOB (sensitive PII) + DPIA — see §5. High value, real compliance weight. |
| 5 | **Reliable notifications** (email first; fix auth SMTP via Resend, add payment/enrolment confirmations) | ~1 wk | Beats Aladdin at the thing it's broken at |
| 6 | **PWA / installable web app** (manifest + service worker) | ~1 wk | Closes most of the "no app" gap without native iOS/Android |
| 7 | **SMS option** (e.g. via a provider) | ~1 wk | Specialists have it; parents expect text reminders |

## 8. Build plan — Tier 3 (their moat — caution)

Messaging / noticeboard / permission slips / enrolment forms / full MIS. This is where Aladdin is **strong and entrenched**; building it to compete head-on is a multi-year effort and **not** advised as a wedge. Only relevant if pursuing a full-platform play after a wedge is proven.

---

## 9. Strategic conclusion

- Aladdin is beatable on **experience for a focused job**, not on **breadth** (overall scorecard 34 vs 21 — see body of analysis).
- The **payments field is crowded, framework-gated, and guest-pay is table stakes** — "better payments" alone is not a wedge.
- School Demo's **only differentiated position across all players** is **payments + attendance + per-pupil analytics in one modern tool**, or an **adjacent buyer** (clubs/childcare) with no Aladdin.
- **Do Tier 1 (cheap, leans on existing strengths) and validate the combined wedge with principals BEFORE Tier 2/4 build.** Ties directly to the go/kill criteria in `docs/market-validation.md`. The OGP framework barrier and Tusla PPSN data-sensitivity are the two biggest non-UI obstacles to a serious commercial entry.
