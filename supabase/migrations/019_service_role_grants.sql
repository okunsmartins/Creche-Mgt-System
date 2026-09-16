-- Grant ALL privileges on every public table and sequence to service_role.
--
-- In this Supabase project the service_role PostgreSQL role does not receive
-- automatic DML grants when tables are created via migrations (the default
-- ALTER DEFAULT PRIVILEGES grant is not in effect). Without explicit grants
-- service_role can bypass RLS but still gets a PostgreSQL 42501 error for any
-- SELECT, INSERT, UPDATE, or DELETE it attempts.
--
-- These grants are idempotent and safe to re-run.

-- Schema usage
GRANT USAGE ON SCHEMA public TO service_role;

-- All tables
GRANT ALL ON public.profiles                    TO service_role;
GRANT ALL ON public.user_roles                  TO service_role;
GRANT ALL ON public.roles                       TO service_role;
GRANT ALL ON public.permissions                 TO service_role;
GRANT ALL ON public.role_permissions            TO service_role;
GRANT ALL ON public.schools                     TO service_role;
GRANT ALL ON public.school_settings             TO service_role;
GRANT ALL ON public.classes                     TO service_role;
GRANT ALL ON public.students                    TO service_role;
GRANT ALL ON public.teachers                    TO service_role;
GRANT ALL ON public.activities                  TO service_role;
GRANT ALL ON public.activity_class_eligibility  TO service_role;
GRANT ALL ON public.orders                      TO service_role;
GRANT ALL ON public.order_items                 TO service_role;
GRANT ALL ON public.payments                    TO service_role;
GRANT ALL ON public.refunds                     TO service_role;
GRANT ALL ON public.webhook_events              TO service_role;
GRANT ALL ON public.audit_logs                  TO service_role;
GRANT ALL ON public.email_notifications         TO service_role;
GRANT ALL ON public.parent_student_links        TO service_role;
GRANT ALL ON public.parent_link_requests        TO service_role;
GRANT ALL ON public.payment_links               TO service_role;

-- Sequences (needed for any SERIAL / IDENTITY columns and for nextval() calls)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
