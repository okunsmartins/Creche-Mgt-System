-- =============================================================================
-- Migration 032: Service-role grants for attendance tables
-- =============================================================================
-- Migration 031 created attendance_sessions and attendance_records but did not
-- grant table privileges to service_role. This project has NO default
-- privileges configured (see migrations 019–021), so every table needs
-- explicit grants. Without them, the admin client (service role) fails with
-- PostgreSQL error 42501 (permission denied) on both reads and writes —
-- which manifested as "Failed to create session" in the teacher portal and
-- "0 sessions" on the dashboard.
--
-- These grants are idempotent and safe to re-run.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_records TO service_role;
