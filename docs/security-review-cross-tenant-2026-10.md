# Cross-Tenant Isolation Security Review

**Status:** Completed (static code audit) · **Date:** 2026-10-03 · **Reviewer:** First Stack Solutions
**Scope:** Whether any user of Crèche A can view / infer / modify / delete / export Crèche B's data.
**Method:** Static audit of every server-side data path against the cross-tenant review brief, plus the
DB-backed `scripts/verify-tenant-isolation.mjs` (run against the live dev project).

> **Verdict: no cross-tenant data-isolation vulnerabilities found.** Two minor integrity notes (below),
> one now fixed. A live multi-tenant penetration test is still recommended before commercial go-live
> (this review is static + DB-layer, not runtime fuzzing).

---

## 1. Tenant-isolation model

- **Tenant key:** every tenant-owned table carries `school_id` (FK → `schools`). Users carry `schoolId`
  in their JWT-backed session (`SessionUser`).
- **Two enforcement layers:**
  1. **App-layer scoping** — queries go through the **service-role** client (`createSupabaseAdminClient`),
     which **bypasses RLS**. So an explicit `.eq('school_id', …)` (or an ownership check) on every query is
     the **primary** control.
  2. **RLS deny-by-default** on every table — a backstop for the anon/`authenticated` clients (e.g. if a
     query ever used the non-admin client). Verified: anon key returns **0 rows** on every tenant table.
- **Parent access** is scoped by `parent_id` + ownership via `parent_student_links` (not by raw child id).
- **Platform owner** is the only legitimate cross-tenant surface — `/platform` is gated by
  `requireAuth` + `isPlatformOwner` → `notFound()` for non-owners (doesn't reveal the section exists).

## 2. Findings

| Area | Result |
|---|---|
| RLS coverage | ✅ Enabled on **all** tenant tables (verified table-by-table) |
| Crèche-new modules (collection, collectors, fees, daily-records, enquiries, checkin) | ✅ Every `.eq('id')` paired with `.eq('school_id')`; parent flows gated by active `parent_student_links` |
| Inherited mutations (orders, refunds, documents, students, classes, teachers, payment-links, messages) | ✅ Safe — "verify-then-act" (fetch + `school_id`/ownership check before mutating by id), own-row rollbacks, or own-school assignment |
| Refunds (financial) | ✅ Rejects if `order.school_id !== admin.schoolId` before acting; payments scoped by `order_id` |
| Documents (sensitive files) | ✅ `staffSchoolForStudent` gate (admin of the child's school, or the class teacher) before read/delete |
| Reports / exports API (×4) | ✅ `requireAdmin` + Pro-gated + `school_id`-scoped (refunds via `orders!inner.school_id`) |
| Webhooks (Stripe / Revolut / Twilio) | ✅ Signatures verified on the raw body before acting; Revolut resolves per-school tenant from the order ext-ref |
| Platform owner (`/platform`) | ✅ Owner-only (`isPlatformOwner`), else 404 |
| Automated DB test | ✅ `verify-tenant-isolation.mjs` — 26 checks incl. "Tenant B cannot modify Tenant A's run / enrolment / collector", scoping, anon-blocked RLS |

## 3. Minor / informational (not data-isolation breaches)

1. **Payment-link counter bumps were client-callable actions scoped only by id** — `incrementPaymentLink*Count`
   lived in a `'use server'` file, so a client could bump an arbitrary link's counter by UUID (integrity
   nuisance, no data exposure). **Fixed 2026-10-03:** removed the dead `incrementPaymentLinkUseCount`, and
   scoped `incrementPaymentLinkVisitCount` by `school_id` (the public pay page passes the link's resolved
   `school_id`). **Follow-up:** `incrementPaymentLinkCompletedOrderCount` is the same pattern but is only
   invoked from the signature-verified Stripe webhook; scope it by `school_id` too for consistency.
2. **`students.resolveSchoolId`** self-assigns a parent to the sole school — inert unless exactly one school
   exists (single-tenant dev convenience); harmless in multi-tenant prod.

## 4. Recommendations

- Keep the discipline: every new tenant table ships with `school_id` scoping + RLS + a line in
  `verify-tenant-isolation.mjs` **in the same PR**.
- Scope `incrementPaymentLinkCompletedOrderCount` by `school_id` (follow-up).
- Before commercial go-live, run a **live multi-tenant penetration test** (the runtime half of the review
  brief: 3-tenant canary data, file-URL guessing, pagination/search enumeration, role-matrix abuse) — the
  automated script covers the data layer, a pentest completes the picture.
