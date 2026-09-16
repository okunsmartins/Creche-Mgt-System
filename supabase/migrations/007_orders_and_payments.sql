-- =============================================================================
-- Migration 007: Orders, order items, payments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  order_reference   TEXT NOT NULL UNIQUE DEFAULT public.generate_order_reference(),
  payer_profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_payer_name  TEXT,
  guest_payer_email TEXT,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  subtotal_cents    INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  total_cents       INTEGER NOT NULL CHECK (total_cents >= 0),
  status            public.order_status NOT NULL DEFAULT 'draft',
  source            public.order_source NOT NULL,
  correlation_id    TEXT,               -- request-scoped tracing ID
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Must have either a registered payer or guest details
  CONSTRAINT chk_orders_payer
    CHECK (
      payer_profile_id IS NOT NULL
      OR (guest_payer_name IS NOT NULL AND guest_payer_email IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Linked student (NULL for manual guest entries)
  student_id                 UUID REFERENCES public.students(id) ON DELETE SET NULL,
  -- Manual guest entry fields
  manual_student_first_name  TEXT,
  manual_student_last_name   TEXT,
  -- class_id retained for foreign-key integrity; snapshot used for display/reports
  class_id                   UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  -- Snapshots preserve historical accuracy if student/class/activity data changes later
  student_name_snapshot      TEXT NOT NULL,
  class_name_snapshot        TEXT NOT NULL,
  activity_id                UUID NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  activity_name_snapshot     TEXT NOT NULL,
  -- Price locked at the time of order creation — never recalculate from live activity
  unit_amount_cents          INTEGER NOT NULL CHECK (unit_amount_cents >= 0),
  item_reference             TEXT NOT NULL UNIQUE DEFAULT public.generate_item_reference(),
  verification_status        public.verification_status NOT NULL DEFAULT 'unverified',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Either a known student or manual name fields must be supplied
  CONSTRAINT chk_order_items_student
    CHECK (
      student_id IS NOT NULL
      OR (manual_student_first_name IS NOT NULL AND manual_student_last_name IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_reference           TEXT NOT NULL UNIQUE DEFAULT public.generate_payment_reference(),
  provider                    public.payment_provider NOT NULL DEFAULT 'stripe',
  provider_checkout_session_id TEXT,
  provider_payment_intent_id  TEXT,
  amount_cents                INTEGER NOT NULL CHECK (amount_cents >= 0),
  refunded_amount_cents       INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  currency                    TEXT NOT NULL DEFAULT 'EUR',
  status                      public.payment_status NOT NULL DEFAULT 'pending',
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Refunded amount cannot exceed paid amount
  CONSTRAINT chk_payments_refund_amount
    CHECK (refunded_amount_cents <= amount_cents)
);

-- Indexes
CREATE INDEX idx_orders_school_id         ON public.orders(school_id);
CREATE INDEX idx_orders_status            ON public.orders(school_id, status);
CREATE INDEX idx_orders_payer_profile_id  ON public.orders(payer_profile_id);
CREATE INDEX idx_orders_order_reference   ON public.orders(order_reference);
CREATE INDEX idx_orders_created_at        ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX idx_order_items_student_id   ON public.order_items(student_id);
CREATE INDEX idx_order_items_activity_id  ON public.order_items(activity_id);
CREATE INDEX idx_payments_order_id        ON public.payments(order_id);
CREATE INDEX idx_payments_session_id      ON public.payments(provider_checkout_session_id);
CREATE INDEX idx_payments_intent_id       ON public.payments(provider_payment_intent_id);
CREATE INDEX idx_payments_status          ON public.payments(status);

-- Trigger
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
