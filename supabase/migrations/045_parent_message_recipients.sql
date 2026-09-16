-- =============================================================================
-- Migration 045: Parent message in-app inbox — feature #1, Phase 4
-- =============================================================================
-- Per-recipient delivery records so each parent has an in-app inbox in the parent
-- portal (in addition to the email they already receive). One row per
-- (message, parent); read_at tracks read/unread. The send action writes one row
-- per resolved recipient alongside the email.
--
-- No ALTER TYPE here, so it is safe to run as a single transaction.
--
-- RLS note: parent portal pages read via the service-role admin client scoped to
-- the logged-in user's id (auth.uid() is null in Server Components, so an
-- auth.uid()-based policy would return 0 rows — same pattern as orders). The RLS
-- policy below is defence-in-depth; the actual read path is service-role + a
-- manual parent_id filter.

CREATE TABLE public.parent_message_recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.parent_messages(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A parent gets at most one inbox row per message.
  UNIQUE (message_id, parent_id)
);

CREATE INDEX idx_pmr_parent ON public.parent_message_recipients(parent_id, created_at DESC);
CREATE INDEX idx_pmr_message ON public.parent_message_recipients(message_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.parent_message_recipients ENABLE ROW LEVEL SECURITY;

-- A parent may read their own inbox rows (defence-in-depth; reads actually go
-- through the service-role client scoped to the user id). Writes are
-- service-role only (the send + mark-read actions).
CREATE POLICY "parents_read_own_inbox" ON public.parent_message_recipients
  FOR SELECT USING (parent_id = auth.uid());

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.parent_message_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_message_recipients TO service_role;
