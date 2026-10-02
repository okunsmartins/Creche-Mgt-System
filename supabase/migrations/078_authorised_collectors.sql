-- =============================================================================
-- Migration 078: Authorised collectors (Feature B)
-- =============================================================================
-- Design: docs/design/school-collection-and-authorised-collectors.md
-- Tusla School-Age / Early Years services must record, per child, who is
-- authorised to collect them (+ written consent, + whether they may leave
-- unaccompanied). This table is that per-child register, with a crèche approval
-- step. A collector may be proposed by a parent OR by staff.
--
-- Conventions (match 070–077): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).
--
-- `collection_password_hash` holds a ONE-WAY hash (scrypt) of an optional door
-- word used to verify the person at hand-over — never plaintext. See
-- src/lib/collectors/password.ts.

CREATE TABLE public.authorised_collectors (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                 UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  full_name                  TEXT NOT NULL,
  relationship               TEXT NOT NULL
                               CHECK (relationship IN ('parent','guardian','grandparent',
                                                       'aunt_uncle','sibling','childminder','other')),
  phone                      TEXT,
  photo_path                 TEXT,
  collection_password_hash   TEXT,
  can_collect_unaccompanied  BOOLEAN NOT NULL DEFAULT FALSE,
  status                     TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','declined','revoked')),
  proposed_by                TEXT NOT NULL DEFAULT 'staff'
                               CHECK (proposed_by IN ('parent','staff')),
  proposed_by_profile_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_profile_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                      TEXT,
  is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_collector_name CHECK (trim(full_name) <> '')
);

-- Per-child lookups, newest first; pending-first handled in the query.
CREATE INDEX idx_collectors_scope ON public.authorised_collectors(school_id, student_id, status);

-- Avoid duplicate ACTIVE collectors for the same child (same name + phone). Partial
-- unique so revoked/declined history doesn't block re-adding later.
CREATE UNIQUE INDEX uq_collector_active
  ON public.authorised_collectors(student_id, lower(trim(full_name)), coalesce(phone, ''))
  WHERE is_active;

CREATE TRIGGER trg_collectors_updated_at
  BEFORE UPDATE ON public.authorised_collectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; the service-role client does the work) ─────────────
ALTER TABLE public.authorised_collectors ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.authorised_collectors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorised_collectors TO service_role;
