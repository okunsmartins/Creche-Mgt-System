-- =============================================================================
-- Migration 070: Custom field definitions + JSONB value columns
-- =============================================================================
-- CF-01 (Layer 3 of dynamic-onboarding-fields.md). Tenant-defined extra fields
-- that can be created on the fly (incl. during import) and later PROMOTED into
-- system functions (billing/dashboard/reporting/filter/messaging/compliance).
--
--   * custom_field_definitions — one row per tenant-defined field (type, options,
--     required, promotion targets). TEXT + CHECK throughout.
--   * custom_fields JSONB — a values bag added to each core entity table. Values
--     live on the tenant-scoped row itself, so existing RLS/tenant-scoping covers
--     them (no separate EAV values table, no new isolation surface).
--
-- Guardrail: money/NCS/compliance logic only ever reads a field that has been
-- promoted WITH a validated type (enforced in app layer, src/lib/custom-fields).
-- Reads/writes go through the service-role admin client; RLS on as defence-in-depth.

CREATE TABLE public.custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity          TEXT NOT NULL CHECK (entity IN ('child', 'parent', 'staff', 'room')),
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  field_type      TEXT NOT NULL CHECK (field_type IN
                    ('text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'multiselect')),
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  required        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Promotion targets this field participates in, e.g. ["billing","messaging"].
  promoted_to     JSONB NOT NULL DEFAULT '[]'::jsonb,
  affects_billing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- One definition per (tenant, entity, key); the key is a slug of the label.
  CONSTRAINT custom_field_key_unique UNIQUE (school_id, entity, key)
);

CREATE INDEX idx_custom_field_defs_scope
  ON public.custom_field_definitions(school_id, entity, sort_order);

CREATE TRIGGER trg_custom_field_defs_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Value bags on the core entity tables (child/parent/staff/room).
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.classes  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.custom_field_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_definitions TO service_role;
