# Scoil Bhríde Online Payment Portal

A secure, accessible payment management portal for Scoil Bhríde primary school.

> **Proof of concept** using fictional data only. Not for production use without completing all setup steps in [docs/deployment.md](docs/deployment.md).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — add Supabase, Stripe and Resend credentials

# 3. Apply database migrations (via Supabase Dashboard SQL Editor or CLI)
# See docs/deployment.md for full instructions

# 4. Start development server
npm run dev
# → http://localhost:3000
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Payments | Stripe Checkout (test mode) |
| Email | Resend |
| Validation | Zod + React Hook Form |
| Unit tests | Vitest + React Testing Library |
| E2E tests | Playwright |
| Deployment | Vercel |

## Available scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run type-check   # TypeScript type check
npm run lint         # ESLint
npm run format       # Prettier format
npm test             # Vitest unit + integration tests
npm run test:e2e     # Playwright end-to-end tests
```

## Project structure

```
src/app/            Next.js App Router pages
src/components/     Shared UI components
src/features/       Domain feature modules (auth, students, payments…)
src/lib/            Supabase, Stripe, Resend, logging, utilities
src/types/          TypeScript types and database schema
supabase/           SQL migrations and seed data
docs/               Architecture, security, deployment guides
e2e/                Playwright test scenarios
public/branding/    Logo assets
```

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System architecture and data flows |
| [docs/database.md](docs/database.md) | Schema, relationships, status transitions |
| [docs/security.md](docs/security.md) | Security design and threat model |
| [docs/deployment.md](docs/deployment.md) | Dev setup, production deployment, Stripe/Resend config |
| [docs/assumptions.md](docs/assumptions.md) | Documented design decisions and exclusions |
| [docs/implementation-status.md](docs/implementation-status.md) | Phase-by-phase build progress |

## Implementation phases

- ✅ **Phase 1** — Foundation, migrations, seed data, branding, UI primitives
- 🔲 **Phase 2** — Authentication, roles, permissions, route protection
- 🔲 **Phase 3** — Student management, parent-student linking
- 🔲 **Phase 4** — Activity management, eligibility
- 🔲 **Phase 5** — Basket, orders, server-side pricing
- 🔲 **Phase 6** — Stripe Checkout, webhooks, idempotency
- 🔲 **Phase 7** — Email receipts, school notifications, retry
- 🔲 **Phase 8** — Refunds, reports, CSV export, audit
- 🔲 **Phase 9** — Tests, accessibility, deployment

## Security notes

- Card details are never stored (Stripe tokenises these)
- The Stripe secret key and Supabase service role key are server-side only
- Row Level Security is enforced on every database table
- All amounts are server-calculated; client-supplied prices are ignored
- See [docs/security.md](docs/security.md) for the full threat model

## Branding

Replace `public/branding/scoil-bhride-logo.svg` with the approved Scoil Bhríde logo before any external demonstration.

---

*All data in this repository is fictional. No real pupil, parent or staff information is used.*
