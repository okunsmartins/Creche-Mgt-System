# Architecture

## Overview

Scoil Bhríde Online Payment Portal is a **modular Next.js 15 monolith** deployed on Vercel, backed by Supabase (PostgreSQL + Auth) and Stripe.

```
Browser
  │
  ├── Next.js App (Vercel)
  │     ├── Public pages         /  /login /register /guest-payment
  │     ├── Parent portal        /parent/*
  │     ├── Admin portal         /admin/*
  │     ├── Stripe webhook       /api/webhooks/stripe
  │     └── Server Actions       (form mutations)
  │
  ├── Supabase (Postgres + Auth + RLS)
  │     ├── Auth service         email + password
  │     ├── PostgreSQL           20 tables + RLS policies
  │     └── Realtime             not used in POC
  │
  ├── Stripe
  │     ├── Checkout Sessions    hosted payment page
  │     ├── Webhooks             signed event delivery
  │     └── Refunds API          full and partial
  │
  └── Resend
        └── Transactional email  payer receipts + school notifications
```

## Request flow — Registered parent payment

```
1. Parent logs in (Supabase Auth)
2. Parent browses activities (server component, RLS filters by linked students)
3. Parent adds items to basket (server-side session)
4. POST /api/checkout → server action validates basket, creates order + payment rows, creates Stripe Checkout Session
5. Browser redirected to Stripe hosted checkout
6. Stripe processes payment
7. Stripe sends webhook → /api/webhooks/stripe
8. Webhook handler verifies signature, deduplicates via webhook_events table
9. Order status updated to 'paid'
10. Resend email sent (payer receipt + school notification)
11. Browser redirected to /payment/success (informational only — not authoritative)
```

## Request flow — Guest payment

```
1. Guest visits /guest-payment
2. Guest enters pupil code OR name + class (manual)
3. Server looks up pupil code — returns match without revealing existence if no match
4. Guest selects activities
5. Same checkout flow as steps 4–11 above
6. Order item flagged: verification_status = 'manual' if no pupil code match
```

## Key design decisions

### Server-side price authority
The server always retrieves authoritative prices from `activities.amount_cents`. Client-supplied prices are ignored. This prevents price manipulation attacks.

### Webhook idempotency
Every incoming Stripe event is inserted into `webhook_events` with a `UNIQUE(provider, event_id)` constraint. Duplicate events are silently discarded after the first successful processing.

### Reference generation
All references (ORD-, PAY-, ITEM-, REF-) are generated inside PostgreSQL sequences to prevent race conditions and ensure global uniqueness across concurrent requests.

### Soft deletes
No core entity (student, activity, order) is hard-deleted in the POC. Deactivation (`is_active = false`) preserves audit history.

### Email failure isolation
A payment remains `paid` even if email delivery fails. Email failures are recorded in `email_notifications` and are retryable from the admin panel. This prevents email infrastructure issues from blocking payments.

## Directory structure

```
src/
  app/
    (public)/          Public marketing + utility pages
    (auth)/            Login, register, reset-password
    (parent)/          Parent portal (auth-guarded)
    (admin)/           Admin portal (auth + role guarded)
    api/
      webhooks/stripe/ Stripe event receiver
    payment/           Success / cancelled redirect targets
  components/
    layout/            Header, Footer, MobileNav, AdminSidebar
    ui/                Button, Badge, Input, Alert, LoadingSpinner, Modal, Table
  features/
    auth/              Registration, login, session server actions
    students/          Student management
    parents/           Parent dashboard, children, link requests
    activities/        Activity listing, management
    basket/            Basket state, validation
    orders/            Order creation, server-side pricing
    payments/          Stripe checkout, webhook handler
    refunds/           Refund workflow
    reports/           Ledger, activity, class, refund, audit
    audit/             Audit log writer
  lib/
    auth/              requireAuth, requireRole, getSession
    database/          Typed query helpers
    supabase/          server, client, middleware clients
    stripe/            Checkout session factory, webhook verifier
    email/             Resend templates + sender
    permissions/       Permission check helpers
    validation/        Shared Zod schemas
    logging/           Structured logger
    utils.ts           Shared utilities
  types/
    database.ts        Supabase-typed schema
    index.ts           Application types
  test/
    setup.ts           Vitest / RTL setup
supabase/
  migrations/          001–010 SQL migrations
  seed.sql             Fictional development data
e2e/                   Playwright tests
docs/                  Architecture, security, deployment, etc.
public/
  branding/            Logo assets
```
