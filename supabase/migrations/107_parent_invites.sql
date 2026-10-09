-- =============================================================================
-- Migration 107: parent invite links (first-login + auto-link to a child)
-- =============================================================================
-- A crèche can generate a per-child invite link to email a parent. The parent
-- opens /parent-invite/<token>, creates an account (or signs in), and is
-- automatically attached to the crèche and linked to that child. The token is a
-- 64-hex unguessable secret; single-use and expiring.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit
-- grants. Access is server-side via service_role only (the public page validates
-- the token with the admin client).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.parent_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  email       TEXT,                         -- optional prefill / intended recipient
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,                  -- set when the invite is accepted
  used_by     UUID,                         -- auth.users.id of the parent who accepted
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parent_invites_token ON public.parent_invites(token);
CREATE INDEX idx_parent_invites_student ON public.parent_invites(school_id, student_id);

CREATE TRIGGER trg_parent_invites_updated_at
  BEFORE UPDATE ON public.parent_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_invites TO service_role;
