-- Grant SELECT to anon and authenticated on all publicly-readable tables.
--
-- In this Supabase project, ALTER DEFAULT PRIVILEGES was not set up for the
-- anon and authenticated roles, so tables created via migrations have no
-- table-level grants for those roles. PostgreSQL evaluates RLS policies AFTER
-- checking table-level privileges — without an explicit GRANT SELECT, every
-- anon/authenticated query fails with 42501 permission denied before the RLS
-- policy is even consulted.
--
-- RLS policies in migration 010 already define what each role can see.
-- These grants allow PostgreSQL to reach those policies.
--
-- All grants are SELECT-only. INSERT/UPDATE/DELETE for authenticated users
-- go through server actions that use createSupabaseAdminClient() (service role).
--
-- These grants are idempotent and safe to re-run.

-- Schema usage (required for any table access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── Public / anon-readable tables ────────────────────────────────────────────
-- activities: filtered to published+active+open by RLS policy public_read_published_activities
GRANT SELECT ON public.activities                 TO anon, authenticated;

-- activity_class_eligibility: RLS policy public_read_eligibility allows SELECT USING (TRUE)
GRANT SELECT ON public.activity_class_eligibility TO anon, authenticated;

-- classes: anon_read_classes (is_active=TRUE); authenticated_read_classes (TRUE)
GRANT SELECT ON public.classes                    TO anon, authenticated;

-- schools and school_settings: needed for school name / contact details display
GRANT SELECT ON public.schools                    TO anon, authenticated;
GRANT SELECT ON public.school_settings            TO anon, authenticated;

-- payment_links: RLS policy public_read_active_payment_link_by_token (token lookup)
GRANT SELECT ON public.payment_links              TO anon, authenticated;

-- teachers: RLS policy authenticated_read_active_teachers (is_active=TRUE)
GRANT SELECT ON public.teachers                   TO anon, authenticated;

-- ── Authenticated-only tables ─────────────────────────────────────────────────
-- These tables are only ever queried by logged-in parents via server actions.
-- The server actions use createSupabaseAdminClient() (service role) so these
-- grants are not strictly required for current code, but they are listed here
-- for completeness and in case a future page uses the server client directly.

-- parent_student_links: parents_read_own_links RLS policy
GRANT SELECT ON public.parent_student_links       TO authenticated;

-- parent_link_requests: parents_read_own_requests RLS policy
GRANT SELECT ON public.parent_link_requests       TO authenticated;

-- orders: parents_read_own_orders RLS policy
GRANT SELECT ON public.orders                     TO authenticated;

-- order_items: parents_read_own_order_items RLS policy
GRANT SELECT ON public.order_items                TO authenticated;

-- payments: no direct parent-read policy yet; included for completeness
GRANT SELECT ON public.payments                   TO authenticated;

-- profiles: users_read_own_profile RLS policy (SELECT where id = auth.uid())
GRANT SELECT ON public.profiles                   TO authenticated;
