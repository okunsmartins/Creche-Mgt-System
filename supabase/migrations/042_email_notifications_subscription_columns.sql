-- Subscription emails (dunning, ended) have no order — relax order_id and add a
-- nullable school_id so they can be recorded per tenant in email_notifications.
ALTER TABLE public.email_notifications
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_email_notifs_school_id
  ON public.email_notifications(school_id);

-- Integrity: every notification must reference an order OR a school (never neither).
ALTER TABLE public.email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_order_or_school;
ALTER TABLE public.email_notifications
  ADD CONSTRAINT email_notifications_order_or_school
  CHECK (order_id IS NOT NULL OR school_id IS NOT NULL);

-- email_notifications already grants service_role DML + authenticated SELECT
-- (migrations 019/020/034); the new column inherits those table-level grants.
