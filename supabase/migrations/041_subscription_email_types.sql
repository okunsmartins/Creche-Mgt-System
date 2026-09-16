-- Subscription/dunning email types so subscription lifecycle emails can be logged
-- in email_notifications alongside order emails (see migration 042 for the columns).
-- Kept in its own migration: ALTER TYPE ... ADD VALUE must commit before the new
-- values can be referenced, so it is isolated from the table changes that follow.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'subscription_payment_failed';
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'subscription_ended';
