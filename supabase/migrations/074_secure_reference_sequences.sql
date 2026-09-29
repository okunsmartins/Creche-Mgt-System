-- =============================================================================
-- Migration 074: Secure reference_sequences (RLS + revoke public grants)
-- =============================================================================
-- Supabase's linter flagged `reference_sequences` (migration 002) as
-- rls_disabled_in_public: it had RLS OFF and was readable via the public anon key.
-- It's an internal counter table (INV/ORD/PAY/… sequence values) touched ONLY by
-- the generate_* / next_reference_val functions, which are SECURITY DEFINER and so
-- bypass RLS and table grants. Enabling RLS with no policy (deny-by-default) and
-- revoking anon/authenticated access closes the leak without breaking those RPCs.

ALTER TABLE public.reference_sequences ENABLE ROW LEVEL SECURITY;

-- Nothing legitimate reads this table directly; the SECURITY DEFINER functions
-- don't need table grants. Remove any public exposure.
REVOKE ALL ON public.reference_sequences FROM anon, authenticated;

-- service_role retains access for maintenance (it also bypasses RLS anyway).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_sequences TO service_role;
