-- =============================================================================
-- Migration 106: payment links for programmes (as well as activities)
-- =============================================================================
-- A shareable payment link can now pre-select a PROGRAMME for guest payers, not
-- only an activity. order_items already supports programme payments (mig 029),
-- so only the link target needs widening. Exactly one of activity_id /
-- programme_id is set per link.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TABLE public.payment_links ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES public.programmes(id) ON DELETE RESTRICT;

-- Exactly one target per link.
ALTER TABLE public.payment_links
  ADD CONSTRAINT chk_payment_links_target
  CHECK (num_nonnulls(activity_id, programme_id) = 1);

CREATE INDEX IF NOT EXISTS idx_payment_links_programme_id ON public.payment_links(programme_id);
