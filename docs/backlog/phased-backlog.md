# Crèche Platform — Phased Backlog & Sequencing

**Status:** Draft for review · **Date:** 2026-09-16
**Basis:** Fork existing stack (ADR-001); deadline self-imposed/flexible; NCS/ECCE core in V1.

## The sequencing insight

Work splits into three tracks with very different risk profiles. **Sequence them so the external-dependency track runs in the background while you build.**

- 🟢 **Reuse** — adapt from Skool Bido/Scoil Bhríde. Fast, low risk.
- 🔴 **Net-new** — no precedent. Higher effort, but **no external dependency** → fully under your control.
- 🟠 **External long pole** — gated by third parties (KYC, ComReg, DPIA). **Start Day 0, build code behind abstractions meanwhile.**

The trap to avoid: letting a 🟠 item (Stripe Connect KYC, ComReg SMS registration) sit on the critical path. Kick them all off on Day 0; they mature while you build 🟢 and 🔴 work.

---

## Day 0 — Kick off before writing feature code

| Action | Track | Why Day 0 |
|---|---|---|
| Submit **Stripe Connect** platform application | 🟠 | Review + per-tenant KYC takes days–weeks |
| Start **Revolut Business** merchant onboarding | 🟠 | KYC slow (known from prior project) |
| Begin **ComReg / Twilio A2P** SMS sender registration | 🟠 | Weeks in Ireland |
| Start **email sender-domain** verification (SPF/DKIM/DMARC) | 🟠 | Per-tenant deliverability warm-up |
| Commission **DPIA + threat model** (children's special-category data) | 🟠 | Legally required before pilot; not code |
| Write **ADR-001..004**; fork repo skeleton; CI/DevSecOps gates green on first PR | 🟢 | Spec: CI before first feature |
| Confirm **NCS/ECCE reference rates** with a Pobal/finance SME | 🔴 input | Unblocks the subvention engine |

---

## Phases

| # | Phase | Track | External dep? | Notes / reuse |
|---|---|---|---|---|
| P0 | **Foundation** — tenancy, RLS, auth/RBAC, membership, tenant scoping, audit, CI gates, cross-tenant negative tests | 🟢 | No | Direct reuse; prove isolation first (spec's Week-1 stop condition) |
| P1 | **Core records** — rooms/sessions, child/parent/guardian, emergency/collector, allergy/medical/consent, waiting-list CRM | 🟢 | No | Adapt school-portal records; add crèche fields (room age bands) |
| P2 | **Attendance & staff** — check-in/out, live room counts, **ratio alerts**, staff clocking, rota/timesheets, expiry reminders | 🟢🔴 | No | Attendance reused; **ratio calc + staffing forecast** are new |
| P3 | **Fee engine + SUBVENTION** — annual/term schedules, discounts, invoices, ledger, **ECCE+NCS netting engine** (see design doc) | 🔴 | **No** | The riskiest piece — build & heavily unit-test in parallel with 🟠 track |
| P4 | **Payments** — Stripe **Connect** per-tenant, full payment, **instalments (>€20)**, webhooks, refunds, arrears reminders | 🟢🔴🟠 | **Yes (KYC)** | Instalment logic reused; **Connect is net-new**; code behind abstraction, sandbox first, activate on approval |
| P5 | **Comms** — in-app + branded **email** + **SMS**, templates, delivery tracking, preferences/consent, bulk confirm | 🟢🟠 | **Yes (ComReg/domain)** | Reuse messaging plans; platform sender until per-tenant approvals land |
| P6 | **Hive-prep + occupancy + dashboards** — weekly-return prep reports, absence/under-attendance alerts, occupancy/vacancy forecasts, revenue by room/session | 🔴🟢 | No | **Hive = prepare/reconcile, NOT integrate (no API)**; the compliance-alert wedge |
| P7 | **Daily records + compliance centre** — sleep/nappy/meal/learning/incident/medication, policy library, inspection exports, retention | 🟢 | No | Adapt from school portal patterns |
| P8 | **Import wizard** — guided XLSX/CSV, mapping, dry-run, dedup, background job, error export | 🟢 | No | Extend existing CSV bulk-upload |
| P9 | **Hardening & pilot** — full regression, E2E, DAST, SAST/SCA/secrets/IaC/container scans, perf baseline, a11y, pen test, DPIA sign-off, backup/restore rehearsal, UAT | 🔴🟠 | DPIA/pen test | Release-blocking; cannot be compressed |

---

## Milestone mapping (self-imposed, flexible)

- **~2 weeks — Demo slice:** P0 + P1 + P2 + P3 (subvention netting) + one Stripe **sandbox** payment. Sellable, shows the NCS wedge working. **Not pilot-ready.**
- **~4–6 weeks — Single-crèche pilot:** + P4/P5 in sandbox/platform-sender, P6 Hive-prep + alerts, P7/P8. Providers still in KYC/ComReg queues = flagged external dependencies.
- **~8–12 weeks — Market-ready V1:** external approvals activated, P9 complete, DPIA signed. This aligns with the spec's *own* original §14 estimate (14–20 wks) discounted by heavy reuse.

## Governance (from spec, keep)
- No direct commits to `main`; feature branch → PR → CI/DevSecOps gates → review → merge → staging → prod approval.
- Cross-tenant negative test in the **same PR** as every new tenant-owned resource.
- Financial endpoints/jobs idempotent + auditable; migrations backward-compatible (expand/migrate/contract).
- Escalate any blocker > 4 hours; integrate daily; weekly Product Owner acceptance checkpoint.
