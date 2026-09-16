-- =============================================================================
-- Migration 016: Add payment_link_id and acquisition tracking to orders
-- =============================================================================
-- payment_link_id records which payment link originated the order (if any).
-- ON DELETE SET NULL so deleting a link does not remove historical orders.
--
-- acquisition_source / source_reference are free-text attribution fields
-- (e.g. source='payment_link', reference=<payment_link.label>).
-- These are supplementary audit fields — the canonical link is payment_link_id.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_link_id     UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquisition_source  TEXT,
  ADD COLUMN IF NOT EXISTS source_reference    TEXT;

CREATE INDEX idx_orders_payment_link_id ON public.orders(payment_link_id);
