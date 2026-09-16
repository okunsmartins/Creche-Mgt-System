-- Add refund_notice to the email_type enum for refund confirmation emails (spec §12.1).
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'refund_notice';
