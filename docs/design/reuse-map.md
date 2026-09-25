# Reuse Map — Skool Bido → Crèche Platform

**Status:** Findings from code read-through · **Date:** 2026-09-16
**Base:** forked from `scoil-bhride-portal` (Skool Bido). Migrations 001–067, `src/lib/*` domains.

Three buckets: **🟢 Reuse as-is** (rename school→tenant), **🟡 Reshape** (adapt domain), **🔴 Net-new** (build from the design docs).

---

## 🟢 Reuse as-is — the whole multi-tenant + payments + comms spine

| Capability | Where | Notes |
|---|---|---|
| **Tenancy core** | `lib/tenant/{parse,server,provision,urls}.ts`; migs 003, 033, 054 | Subdomain + `/s/<slug>` path resolution, **no default tenant** (hardened against a real cross-tenant incident). `school` → `tenant` is pure naming. |
| **Auth / RBAC** | `lib/auth/{guards,session,actions,schemas}.ts`; migs 004, 009, 036 | Server-side guards, roles, must-change-password. Maps to spec's role matrix. |
| **RLS + grants** | migs 010, 019–021, 034, 035 | RLS policies + service-role/anon/authenticated grants + school-scope helper. Matches your "service-role bypasses RLS → filter every query" discipline. |
| **Stripe Connect (per-tenant)** | `lib/stripe/{connect,connect-status,connectActions}.ts`; mig 066 | ⚠️ **Already built** — `accounts.create` + `account_onboarding` links, **Standard accounts, direct charges, tenant = merchant of record**. This is exactly the crèche model. *(Corrects the earlier "no Connect yet" note.)* |
| **Revolut (per-tenant)** | `lib/revolut/{client,perSchool,signature,settingsActions}.ts`; migs 051, 067 | Per-tenant connection + webhook signature verification. |
| **Payments plumbing** | migs 007, 008, 052; `lib/{orders,refunds,reconciliation,payment-links,basket}` | Orders, payments, refunds, webhooks, reconciliation, guest/pay-by-link. |
| **Instalment math** | `lib/payments/instalments.ts`; mig 023 | Server-authoritative, integer cents, exact-sum reconciliation. **Rules need reshaping (see 🟡).** |
| **Email** | `lib/email/{client,send,from,templates}.ts`; Resend | Branded sending, templates, from/reply-to. |
| **SMS** | `lib/sms/*`; migs 055–057 | ⚠️ **Fully built on Twilio** (REST via fetch, delivery webhook, credits/top-ups, E.164 in `phone.ts`, segments). Inert until Twilio env set. |
| **Parent messaging** | `lib/messages/*`; migs 043–045 | Individual/group/bulk + recipients. |
| **SaaS subscriptions** | `lib/subscriptions/*`; migs 038–042 | For billing crèches for the platform itself (separate from parent fees). |
| **Onboarding/signup** | `lib/onboarding`, `lib/schools`; mig 065 | Tenant self-serve provisioning + portal-signup lead flow. |
| **Docs/uploads, crypto, rate limit, logging, audit** | `lib/{documents,crypto,rateLimit,logging}`; migs 008, 063 | Encrypted fields, audit events, rate limiting — reuse for compliance centre. |

**Implication:** P0 (foundation), P4 (payments), P5 (comms) are **far cheaper than the spec assumes** — the code exists. The remaining P4/P5 cost is real-world activation (Stripe/Revolut KYC, Twilio ComReg/A2P) + adapting to fee-driven charges.

---

## 🟡 Reshape — adapt existing domain to crèche concepts

| From (school) | To (crèche) | Where | Effort |
|---|---|---|---|
| **classes + students** | **rooms + children** | mig 005; `lib/{classes,students}`; ~65 files ref `student`/`class` | Pervasive rename + add crèche fields (age bands, room capacity/ratio, sessions). Mechanical but wide. |
| **teachers** | **staff** | migs 012/013/017/018; `lib/teachers` | Rename + add contracted hours, qualifications, Garda-vetting/expiry. |
| **attendance (per class session)** | **daily check-in/out + live room counts** | migs 031/032/062; `lib/attendance` | Base reusable; add fast tablet check-in, no-show cutoff, and **ratio calc (🔴)**. |
| **instalments: ≥ €20, fixed 4 equal** | **> €20, configurable 2/3/4, freq + first-date** | `lib/payments/instalments.ts` | `>=`→`>`; make count/frequency/date tenant-config. Math stays. |
| **activities / programmes** | **extra services** (after-school, meals, late-collection) | migs 006, 027; `lib/{activities,programmes}` | Optional; good base for the service catalogue + late-collection charge rule. |
| **time-off, meetings, permission-slips, assignments** | same, crèche-flavoured | migs 046–050, 060–064 | Adapt as compliance/parent-experience modules. |

---

## 🔴 Net-new — no precedent, build from the design docs

| Capability | Why net-new | Design |
|---|---|---|
| **Fee-schedule + invoice ledger engine** | ⚠️ **No fee/invoice/billing tables exist** (grep confirmed). School money = one-off orders + SaaS subs only. The crèche's recurring annual/term/weekly fee obligations, invoices, balances and the Draft→Due→Partial→Paid→Overdue state machine are all new. | fee-subvention-engine.md §2, spec §8.5/8.6 |
| **ECCE + NCS subvention layer** | Sits on top of the new fee engine; nets ECCE zero-rating + NCS hourly subsidy off the parent invoice. | fee-subvention-engine.md |
| **Regulatory room ratios** | Attendance exists but no adult:child ratio calc/alerts or staffing forecast. | spec §7.4/7.5 |
| **Hive-prep + funding compliance** | Weekly-return prep reports, absence/under-attendance alerts (no Hive API). | spec §7.7; NCS notes |

---

## Net effect on the plan
- **Payments/comms de-risked** — Stripe Connect + Revolut per-tenant + Twilio SMS are code-complete; treat P4/P5 as *activation + fee-integration*, not builds.
- **The true build cost concentrates in 🔴**: the **fee/invoice engine + subvention + ratios**, plus the **wide-but-mechanical 🟡 rename** (classes/students/teachers → rooms/children/staff).
- Sequence unchanged (backlog P0→P9), but P3 (fee engine + subvention) is confirmed as the single biggest net-new effort, and P4/P5 shrink.
