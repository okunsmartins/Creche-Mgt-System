-- =============================================================================
-- Migration 044: Parent messaging audit table — feature #1, Phase 1
-- =============================================================================
-- Each composed message is recorded once in parent_messages (audit), and each
-- recipient send is recorded in email_notifications (order_id NULL + school_id,
-- type 'parent_message' from migration 043). Recipients are resolved server-side
-- from IDs; teachers are restricted to parents of pupils in their OWN classes
-- (enforced in the server action, not here).
--
-- Run AFTER migration 043 (the enum value).
--
-- RLS note: all reads in the app go through the service-role admin client
-- (createSupabaseAdminClient), which bypasses RLS — the /admin/messages and
-- /teacher/messages pages both use it. So no authenticated-read policy is
-- required for the feature. We still ENABLE RLS (deny-by-default for anon /
-- authenticated) and add a self-contained "sender reads own" policy as
-- defence-in-depth. We deliberately do NOT use the is_admin_of_school() helper
-- here: it is not present in this database, and admin reads don't need it.

CREATE TABLE public.parent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('admin', 'teacher')),
  audience_type   TEXT NOT NULL CHECK (audience_type IN ('class', 'student', 'school')),
  class_id        UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id      UUID REFERENCES public.students(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parent_messages_school_id ON public.parent_messages(school_id, created_at DESC);
CREATE INDEX idx_parent_messages_sender_id ON public.parent_messages(sender_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

-- A sender may read their own messages (self-contained, no helper function).
-- Writes are service-role only (the send action), so no write policy is granted.
-- Admin history reads use the service-role client, which bypasses RLS.
CREATE POLICY "senders_read_own_messages" ON public.parent_messages
  FOR SELECT USING (sender_id = auth.uid());

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.parent_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_messages TO service_role;
