-- =============================================================================
-- Migration 105: invoice + late-collection online payments (FEE-08)
-- =============================================================================
-- Let a parent pay a fees invoice (and a late-collection fee) online, through the
-- crèche's OWN connected Stripe/Revolut account. Payments can now attach to an
-- invoice or a late-collection incident, not only to an order (order_items are
-- hard-coupled to activities, so invoices use their own payment rows). On payment,
-- the webhook marks the invoice/late-fee paid — reflected in parent, child and
-- admin views.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

-- ── payments: attach to an invoice or late-collection (not only an order) ──────
ALTER TABLE public.payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS late_collection_id UUID REFERENCES public.late_collections(id) ON DELETE SET NULL;

-- Each payment is for exactly one subject.
ALTER TABLE public.payments
  ADD CONSTRAINT chk_payments_subject
  CHECK (num_nonnulls(order_id, invoice_id, late_collection_id) = 1);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_late_collection_id ON public.payments(late_collection_id);

-- Webhook idempotency for invoice / late-fee checkout sessions (mirrors the
-- order composite unique from migration 023): a retried Stripe event for the
-- same session cannot insert a duplicate payment row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_invoice_session
  ON public.payments(invoice_id, provider_checkout_session_id)
  WHERE invoice_id IS NOT NULL AND provider_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_latefee_session
  ON public.payments(late_collection_id, provider_checkout_session_id)
  WHERE late_collection_id IS NOT NULL AND provider_checkout_session_id IS NOT NULL;

-- ── late_collections: track payment ───────────────────────────────────────────
ALTER TABLE public.late_collections
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0);
ALTER TABLE public.late_collections
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
