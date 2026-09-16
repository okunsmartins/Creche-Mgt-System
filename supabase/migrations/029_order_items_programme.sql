-- =============================================================================
-- Migration 029: Extend order_items to support programme enrolments
-- =============================================================================
-- Phase B of the Programmes module. Makes activity_id nullable and adds a
-- programme_id FK so a single order can contain a mix of activity payments and
-- programme enrolments. A CHECK constraint enforces exactly one item type per row.

-- 1. Make activity columns nullable (all existing rows retain their values)
ALTER TABLE public.order_items ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN activity_name_snapshot DROP NOT NULL;

-- 2. Add programme columns
ALTER TABLE public.order_items
  ADD COLUMN programme_id UUID REFERENCES public.programmes(id) ON DELETE RESTRICT;

ALTER TABLE public.order_items
  ADD COLUMN programme_name_snapshot TEXT;

-- 3. Exactly one of activity_id / programme_id must be set per row
ALTER TABLE public.order_items
  ADD CONSTRAINT chk_order_items_item_type
  CHECK (
    (activity_id IS NOT NULL AND programme_id IS NULL) OR
    (programme_id IS NOT NULL AND activity_id IS NULL)
  );

-- 4. Index for programme-based queries (attendees page, duplicate detection)
CREATE INDEX idx_order_items_programme_id ON public.order_items(programme_id);

-- 5. Grant SELECT on programme tables to authenticated parents
--    (admin client already has service_role access via migration 027)
GRANT SELECT ON public.programmes TO anon, authenticated;
GRANT SELECT ON public.programme_class_eligibility TO anon, authenticated;
