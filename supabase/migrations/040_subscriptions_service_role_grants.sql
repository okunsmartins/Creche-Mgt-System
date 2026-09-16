-- =============================================================================
-- Migration 040: Service-role grants for the subscriptions table
-- =============================================================================
-- Migration 038 created public.subscriptions and granted SELECT to `authenticated`,
-- but did NOT grant table privileges to `service_role`. This project has NO default
-- privileges configured (see migrations 019–021, 032), so every table needs explicit
-- grants. Without them, the admin client (service role) fails with PostgreSQL error
-- 42501 (permission denied for table subscriptions) on reads and writes — which
-- manifested as: subscription webhooks failing (customer.subscription.* and
-- invoice.payment_* recorded in webhook_events with error "permission denied for
-- table subscriptions"), the checkout pre-insert silently failing, and
-- /admin/subscription always showing "Free".
--
-- Idempotent and safe to re-run.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.subscriptions TO service_role;
