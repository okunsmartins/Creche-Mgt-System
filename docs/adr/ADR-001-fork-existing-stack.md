# ADR-001 — Build the Crèche Platform by forking the existing Vercel/Supabase/Next.js stack

**Status:** Accepted · **Date:** 2026-09-16 · **Deciders:** First Stack Solutions (Product Owner)
**Related:** master spec §5 (proposes AWS/NestJS/Terraform as *proposed defaults*), §16.3, four-week addendum.

## Context

The master specification proposes a greenfield stack: **AWS ECS Fargate + NestJS/Fastify + Terraform**, in a fresh monorepo. It explicitly labels these as **"proposed defaults… can be changed during implementation without losing the underlying requirement,"** and requires stack decisions to be recorded in an ADR before implementation.

First Stack Solutions already runs a **production multi-tenant SaaS** (Skool Bido / Scoil Bhríde school portal) on **Next.js + Supabase (Postgres + RLS) on Vercel**, with per-tenant scoping, subdomains, Stripe + Revolut, subscriptions, instalments, parent email/SMS, attendance, CSV import, and a documented cross-tenant isolation test discipline. A crèche portal is architecturally a variant of that product.

The delivery target is aggressive (self-imposed four-week pilot). Adopting the spec's greenfield stack would discard all reusable code and infrastructure knowledge and effectively guarantee the target is missed.

## Decision

**Build the crèche platform by forking and extending the existing Vercel + Supabase + Next.js stack.** Do **not** stand up ECS Fargate, NestJS, or Terraform for the pilot.

## How we still satisfy the spec's *intent* (not its literal stack)

| Spec requirement | Spec's proposed mechanism | What we do instead |
|---|---|---|
| Strong tenant isolation | Postgres RLS on AWS RDS | Postgres RLS on **Supabase** + service-role tenant-scoping discipline (already learned) |
| Second isolation boundary | RLS + object authz | Same: RLS + server-side object authz on every route/job |
| CI/CD + DevSecOps gates | GitHub Actions → ECS | **GitHub Actions** gates (lint, typecheck, unit, migration, tenant-isolation, SAST/Semgrep, SCA/Dependabot, Gitleaks, Trivy) → **Vercel** deploy |
| IaC (Terraform) | Terraform state per env | Supabase + Vercel managed config; env/secrets in Vercel + Supabase Vault. **Consciously not using Terraform for the pilot** (risk-accepted below) |
| Object storage, signed URLs, malware scan | S3 + KMS | Supabase Storage (tenant-prefixed, signed URLs) + malware-scan step on upload |
| Secrets manager | AWS Secrets Manager/KMS | Vercel env + Supabase Vault; no secrets in repo |
| Async jobs/queue | Redis + worker | Supabase queues / scheduled functions (or a lightweight queue) for reminders, imports, webhooks |
| Provider abstraction | PaymentProvider iface | Reuse existing Stripe/Revolut abstraction; **add Stripe Connect** (net-new) behind it |

## Consequences

**Positive:** ~60–70% conceptual reuse; proven isolation patterns; keeps the four-week pilot plausible; no infra learning curve; existing instalment/messaging/attendance logic extends directly.

**Negative / risk-accepted:**
- **No Terraform / no separate AWS accounts per env.** Environment separation relies on Supabase projects + Vercel environments. *Accepted for pilot; revisit if multi-region or enterprise procurement demands it.*
- **Stripe Connect per-tenant is net-new** to this stack (current portal is single-account). Carries KYC + implementation risk — tracked as a long pole.
- **Vercel/Supabase managed limits** (function timeouts, job durations) must be validated against bulk imports, year-fee generation and bulk messaging (see backlog performance items).
- Divergence from the literal spec must be re-confirmed with the Product Owner if the product is ever sold into an enterprise/tender that mandates AWS.

## Follow-up ADRs to write next
- **ADR-002** — Subvention billing model: `BILL_ON_CONTRACTED` with attendance true-up (see fee-subvention-engine.md §5).
- **ADR-003** — Payments: Stripe Connect per-tenant (direct charges / connected accounts) + Revolut per-tenant behind the shared abstraction.
- **ADR-004** — NCS/ECCE as **core V1 scope** (not deferred), given the Irish market wedge.
