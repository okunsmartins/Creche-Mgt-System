-- =============================================================================
-- Migration 018: Add display_name to teachers; add opens_at, visit_count,
--                completed_order_count to payment_links
-- =============================================================================
-- display_name is the short name shown in payment references, e.g. "Ms Kelly".
-- Defaults to first_name || ' ' || last_name if not set.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Set honorific display names for seed teachers; fall back to first + last for any others
UPDATE public.teachers SET display_name = CASE id
  WHEN '40000000-0000-0000-0000-000000000001' THEN 'Ms Ní Bhriain'
  WHEN '40000000-0000-0000-0000-000000000002' THEN 'Mr Ó Dochartaigh'
  WHEN '40000000-0000-0000-0000-000000000003' THEN 'Ms Mhic Gearailt'
  WHEN '40000000-0000-0000-0000-000000000004' THEN 'Mr Ó Maolalaidh'
  WHEN '40000000-0000-0000-0000-000000000005' THEN 'Ms Uí Cheallaigh'
  WHEN '40000000-0000-0000-0000-000000000006' THEN 'Mr Mac Cormaic'
  WHEN '40000000-0000-0000-0000-000000000007' THEN 'Ms Ní Shúilleabháin'
  WHEN '40000000-0000-0000-0000-000000000008' THEN 'Mr Ó Briain'
  ELSE first_name || ' ' || last_name
END
WHERE display_name IS NULL;

-- opens_at lets a payment link have a future open date (analogous to activities.opens_at)
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  ADD COLUMN IF NOT EXISTS completed_order_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_order_count >= 0);

-- Update the public RLS policy to also enforce opens_at
DROP POLICY IF EXISTS "public_read_active_payment_link_by_token" ON public.payment_links;

CREATE POLICY "public_read_active_payment_link_by_token" ON public.payment_links
  FOR SELECT USING (
    is_active = TRUE
    AND (opens_at   IS NULL OR opens_at   <= NOW())
    AND (expires_at IS NULL OR expires_at  > NOW())
    AND (max_uses   IS NULL OR use_count   < max_uses)
  );
