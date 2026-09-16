-- =============================================================================
-- Migration 034: RLS hardening, slice 1 — authenticated SELECT grants + helper
-- =============================================================================
-- Part of multi-tenant Step 2. This slice is ADDITIVE and SAFE:
--   * Granting SELECT to `authenticated` does NOT expose data — RLS policies
--     still gate every row. Without the grant, RLS is never reached (42501).
--   * The new helper is not yet referenced by any policy (slice 2 will use it).
--
-- IMPORTANT (see docs/implementation-status.md): the EXISTING admin RLS policies
-- are NOT school-scoped (they use user_has_permission() with no school_id check).
-- Reads must NOT be switched to the RLS client until slice 2 rewrites those
-- policies to be school-scoped using is_admin_of_school() below.

-- ─── authenticated SELECT grants for tenant tables missing them ───────────────
-- (migration 021 granted the others; these were created later or omitted)
GRANT SELECT ON public.students                     TO authenticated;
GRANT SELECT ON public.programmes                   TO authenticated;
GRANT SELECT ON public.programme_class_eligibility  TO authenticated;
GRANT SELECT ON public.attendance_sessions          TO authenticated;
GRANT SELECT ON public.attendance_records           TO authenticated;
GRANT SELECT ON public.refunds                      TO authenticated;
GRANT SELECT ON public.email_notifications          TO authenticated;
GRANT SELECT ON public.webhook_events               TO authenticated;
GRANT SELECT ON public.audit_logs                   TO authenticated;

-- ─── School-scoped admin helper (used by slice 2 policies) ────────────────────
-- True when the current user holds an admin role *for the given school*.
-- SECURITY DEFINER so it can read user_roles regardless of that table's RLS.
CREATE OR REPLACE FUNCTION public.is_admin_of_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = p_school_id
      AND r.name IN ('super_admin', 'school_admin', 'finance_admin')
  );
$$;
