-- Migration 023: Installment payment support
-- Adds partially_paid order status, tracks cumulative amount paid, and relaxes
-- the UNIQUE(order_id) constraint on payments so each installment gets its own row.

-- 1. New enum value — allows orders to sit between deposit and full payment
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 2. Track cumulative payments and whether the payer chose an instalment plan
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER NOT NULL DEFAULT 0
    CONSTRAINT orders_amount_paid_non_negative CHECK (amount_paid_cents >= 0),
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'full'
    CONSTRAINT orders_payment_type_values CHECK (payment_type IN ('full', 'installment'));

-- 3. Drop the old single-payment unique constraint on payments.order_id
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_order_id_key;

-- 4. Add a new constraint: one payment row per (order, Stripe checkout session).
--    This prevents duplicate webhook delivery from inserting the same session twice
--    while allowing multiple instalment rows for the same order.
ALTER TABLE public.payments
  ADD CONSTRAINT payments_order_session_unique
  UNIQUE (order_id, provider_checkout_session_id);
