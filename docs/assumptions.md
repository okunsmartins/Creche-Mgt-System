# Documented Assumptions

## Technology

1. **Next.js 15 App Router** is the correct routing model. Pages API is not used.
2. **Supabase** is used for both authentication and database. Auth is Supabase's built-in email+password provider. OAuth is not in scope for the POC.
3. **Stripe Checkout** (hosted) is used in test mode. Stripe Elements (embedded) is not required for the POC.
4. **Resend** is used for transactional email. A verified sending domain will be configured before production use.
5. **Vercel** is the deployment target. Edge runtime is not required; Node.js runtime is sufficient.
6. **Supabase EU region** (eu-west-1 Ireland) is preferred for GDPR and data sovereignty.

## Financial

7. **Euros only.** All amounts stored as integer cents (e.g. €25.00 = 2500).
8. **Full basket payments only** in the POC. Instalments and partial payments require schema additions but are designed for (the schema is extensible).
9. **Test mode Stripe** throughout the POC. Live mode requires explicit approval.
10. **No Stripe Connect.** Single destination account (the school). Multi-school Stripe routing is out of scope.

## Data and Privacy

11. **Only fictional data** in the POC. No real pupil names, parent emails or payment-card details are used.
12. **No date of birth or medical information** is collected.
13. **Data retention** defaults to 7 years per Irish Revenue requirements for financial records. Automatic deletion is not implemented until retention rules are formally approved.
14. **GDPR compliance** requires a formal Privacy Notice and Data Processing Agreement with Supabase, Stripe and Resend before production launch.

## Authentication and Authorisation

15. **Email verification is mandatory** before parents can access payment features.
16. **A single super administrator** is created manually via Supabase Auth; credentials are never committed.
17. **Teacher class assignments** are stored in a `teacher_class_assignments` table (added in Phase 3). The RLS stub in migration 010 restricts teachers; the application-layer restriction is added in Phase 3.
18. **Guest payments** do not create auth accounts. Guest payer email is used only for receipts.

## Branding

19. **Logo**: A placeholder SVG is provided at `public/branding/scoil-bhride-logo.svg`. The approved Scoil Bhríde logo must be supplied and placed in that path before any external demonstration.

## Scope Exclusions (POC)

20. **No accounting-package integration** (Xero, Sage, etc.) in Phase 1–9.
21. **No multi-school support** in the POC. `school_id` is present on all core tables to make it possible without rewriting the schema.
22. **No direct bank integration.** All payments are through Stripe.
23. **No SMS notifications.** Email only.
24. **No Excel or PDF export** in Phase 1–9. CSV first; structure is designed to add these later.
25. **No automated data deletion.** Retention settings are configurable; deletion is a manual admin action pending formal approval.
