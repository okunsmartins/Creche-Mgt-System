-- Grant INSERT, UPDATE, DELETE on all public tables to service_role.
--
-- Migration 019 was applied to the live database with SELECT-only grants.
-- This migration adds the missing DML permissions so that admin server
-- actions (updateStudentAction, createActivityAction, initiateRefundAction,
-- audit log writes, etc.) no longer fail with PostgreSQL error 42501.
--
-- These grants are idempotent and safe to re-run.

-- Schema usage (idempotent)
GRANT USAGE ON SCHEMA public TO service_role;

-- DML grants for every application-writable table
GRANT INSERT, UPDATE, DELETE ON public.profiles                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.schools                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.school_settings            TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.classes                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.students                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.teachers                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.activities                 TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.activity_class_eligibility TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.orders                     TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.order_items                TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.payments                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.refunds                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.webhook_events             TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.audit_logs                 TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.email_notifications        TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.parent_student_links       TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.parent_link_requests       TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.payment_links              TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.user_roles                 TO service_role;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
