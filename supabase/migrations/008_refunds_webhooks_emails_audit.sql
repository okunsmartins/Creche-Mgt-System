-- =============================================================================
-- Migration 008: Refunds, webhook events, email notifications, audit logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  refund_reference  TEXT NOT NULL UNIQUE DEFAULT public.generate_refund_reference(),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'EUR',
  reason            TEXT,
  status            public.refund_status NOT NULL DEFAULT 'pending',
  provider_refund_id TEXT,             -- Stripe refund ID (re_...)
  requested_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency table for Stripe webhook events.
-- The unique constraint on (provider, event_id) prevents duplicate processing.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      public.payment_provider NOT NULL DEFAULT 'stripe',
  event_id      TEXT NOT NULL,          -- Stripe event ID (evt_...)
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  processed     BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type                public.email_type NOT NULL,
  recipient_email     TEXT NOT NULL,
  subject             TEXT NOT NULL,
  status              public.email_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,             -- Resend message ID
  failure_details     TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only audit log — no UPDATE or DELETE policies
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id      UUID,                   -- auth.users.id (not FK to allow log after user deletion)
  actor_email   TEXT,
  action        public.audit_action NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  metadata      JSONB,                  -- safe non-sensitive context only
  correlation_id TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refunds_payment_id       ON public.refunds(payment_id);
CREATE INDEX idx_refunds_order_id         ON public.refunds(order_id);
CREATE INDEX idx_refunds_status           ON public.refunds(status);
CREATE INDEX idx_webhook_events_event_id  ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed, created_at DESC);
CREATE INDEX idx_email_notifs_order_id    ON public.email_notifications(order_id);
CREATE INDEX idx_email_notifs_status      ON public.email_notifications(status);
CREATE INDEX idx_audit_logs_actor_id      ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action        ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource      ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at    ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_school_id     ON public.audit_logs(school_id, created_at DESC);

-- Triggers
CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_email_notifs_updated_at
  BEFORE UPDATE ON public.email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
