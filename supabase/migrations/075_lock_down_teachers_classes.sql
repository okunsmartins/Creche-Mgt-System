-- =============================================================================
-- Migration 075: Lock down teachers & classes to server-side only (privacy)
-- =============================================================================
-- The fork inherited public "anon_read" policies on teachers and classes (from the
-- school portal's public class/teacher lists — migrations 010/012). For a crèche,
-- that exposes active STAFF names/emails and rooms to anyone holding the public
-- anon key. A full-codebase audit confirms EVERY read of these tables goes through
-- the service-role admin client (which bypasses RLS) — no app code uses the anon or
-- authenticated (RLS-respecting) client for them — so removing public/authenticated
-- read access is safe and closes the exposure. Admin management policies and
-- service_role grants are untouched.

-- teachers
DROP POLICY IF EXISTS "anon_read_active_teachers" ON public.teachers;
DROP POLICY IF EXISTS "authenticated_read_active_teachers" ON public.teachers;
REVOKE SELECT ON public.teachers FROM anon, authenticated;

-- classes
DROP POLICY IF EXISTS "anon_read_classes" ON public.classes;
DROP POLICY IF EXISTS "authenticated_read_classes" ON public.classes;
REVOKE SELECT ON public.classes FROM anon, authenticated;
