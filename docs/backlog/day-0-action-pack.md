# Day-0 Action Pack — start the external clock this week

**Status:** Action list · **Date:** 2026-09-16
**Why this exists:** These items are gated by third parties (KYC, telecom registration, legal). They are the **true critical path** — code can catch up to them, they cannot catch up to code. Start all five now; build behind abstractions while they mature.

> Lead times below are rough planning ranges, not guarantees — treat as "start now," and confirm actuals with each provider. Owner = you unless a task is delegated.

---

## 1. Stripe Connect (per-tenant merchant accounts) — 🟠 highest payment risk
**Why critical:** each crèche receives its own parent payments = its own connected account with its own KYC. This is **net-new** for you (current portal is single-account).
**Do now:**
- In your Stripe dashboard, apply to enable **Connect** on the platform account (choose the connected-account type — likely **Express or Standard** for crèches; decide in ADR-003).
- Confirm the commercial/legal account model: crèche as merchant of record (direct charges) vs platform. This affects liability and payout flow.
- Note what each *tenant* will need to submit later (business details, IBAN, ID) so onboarding UX can collect it.
**Lead time:** platform Connect enablement fast; **per-tenant KYC days–weeks each.**
**Unblocks:** P4 payments activation.

## 2. Revolut Business / Merchant (per-tenant) — 🟠 known-slow KYC
**Why critical:** you already know Revolut Business KYC is slow.
**Do now:**
- Start the **Revolut Business onboarding** for the merchant model; confirm whether per-tenant merchant connection or a partner model is available.
- Flag: spec warns *"do not assume automated account creation"* — verify the onboarding path before promising per-tenant self-serve.
**Lead time:** **weeks** (KYC).
**Unblocks:** P4 Revolut parity (P1 priority; can trail Stripe).

## 3. SMS sender registration (ComReg / Twilio A2P) — 🟠 longest telecom pole
**Why critical:** Irish A2P/sender-ID registration must be approved before reliable parent SMS.
**Do now:**
- Open/confirm the **Twilio** (or chosen gateway) account.
- Begin **ComReg / A2P sender-ID / brand + campaign registration** for Ireland.
- Decide default sender identity and per-tenant policy.
**Lead time:** **often several weeks.**
**Unblocks:** P5 SMS (until approved, use platform sender / fall back to email + in-app).

## 4. Email sending domain (SPF/DKIM/DMARC) — 🟠 deliverability warm-up
**Why critical:** branded, reliable delivery needs verified domains; per-tenant sender domains add overhead.
**Do now:**
- In your email provider (Resend, per prior projects), start **domain verification** for the platform sender; publish SPF/DKIM (+DMARC).
- Decide V1 policy: **platform-approved sender domain with tenant name shown** (fast) vs per-tenant verified domains (later).
**Lead time:** verification hours–days; **reputation warm-up longer.**
**Unblocks:** P5 email.

## 5. DPIA + threat model — 🟠 legal gate, not code
**Why critical:** the platform processes **children's special-category health data + PPSN**. A signed DPIA is legally required **before** the pilot processes real data — it cannot be compressed at the end.
**Do now:**
- Commission/start the **DPIA and threat model** (spec §10.2). Identify subprocessors (Supabase, Vercel, Stripe, Revolut, Twilio, Resend), EU data residency, retention.
- Book whoever signs it off (DPO/advisor) early.
**Lead time:** **weeks** depending on reviewer availability.
**Unblocks:** P9 pilot go-live.

---

## 6. NCS/ECCE rate confirmation — 🔴 unblocks the riskiest code
**Why critical:** the subvention engine can't be trusted until a Pobal/finance SME confirms current-year figures + the exact subsidy-cap rule.
**Do now:** get the 5 answers in `fee-subvention-engine.md §7` from a childcare finance SME / current Pobal circular.
**Lead time:** days (a phone call / current circular).
**Unblocks:** P3 subvention engine hardening.

---

## What proceeds in parallel while the above mature (no external dependency)
- **P0 Foundation** — fork the existing stack; tenancy, RLS, auth/RBAC, tenant scoping, CI/DevSecOps gates, cross-tenant negative tests. *(Do in the repo where your portal code lives.)*
- **P3 Subvention engine** — build against the design doc using reference rates + `CONFIRM` flags; swap in confirmed rates when item 6 lands.
- **ADR-002/003/004** — billing model, Stripe Connect model, NCS-as-core.

## One-line status tracker (fill in as you go)
| Item | Started | Ref/contact | ETA | Status |
|---|---|---|---|---|
| Stripe Connect | | | | |
| Revolut merchant | | | | |
| SMS ComReg/A2P | | | | |
| Email domain | | | | |
| DPIA | | | | |
| NCS rate confirm | | | | |
